// Global chat variables
let currentChatId = null;
let currentReceiverId = null;
let currentReceiverName = null;
let chatSocket = null;
let currentUserId = null;
let typingTimeout = null;
let allMessagesLoaded = false;
let earliestMessageId = null;
let chatMessages = [];
let loadingMessages = false;
let highlightedUserIds = new Set();

// --- Conversation order state ---
let conversationOrder = JSON.parse(
  localStorage.getItem("conversationOrder") || "[]"
);
let userHasMessages = JSON.parse(
  localStorage.getItem("userHasMessages") || "{}"
);
let lastMessageTimes = JSON.parse(
  localStorage.getItem("lastMessageTimes") || "{}"
);

// Initialize chat functionality
export function initChatFeatures() {
  console.log("🚀 Initializing chat features...");

  getCurrentUserId().then(() => {
    if (!currentUserId) {
      console.error("currentUserId not set after getCurrentUserId!");
      return;
    }
    loadUsers();
    initChatWebSocket();
  });
}

// Get current user ID
function getCurrentUserId() {
  return fetch("/api/user/current", { credentials: "include" })
    .then((res) => res.json())
    .then((data) => {
      if (data.success && data.user) {
        currentUserId = data.user.id; 
        console.log("Current user ID set to:", currentUserId, typeof currentUserId);
      } else {
        console.error("Failed to get current user ID:", data);
      }
      return currentUserId;
    })
    .catch((error) => {
      console.error("Error getting current user:", error);
    });
}

// Load users with conversation ordering
export function loadUsers() {
  console.log("Loading users with conversation ordering...");
  fetch("/api/online-users", { credentials: "include" })
    .then((res) => {
      console.log("Response status:", res.status);
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      return res.json();
    })
    .then((users) => {
      console.log("Received users:", users);
      const globalList = document.getElementById("global-user-list");
      const chatList = document.getElementById("user-list");
      const list = globalList || chatList;
      if (!list) {
        console.error("No user-list element found");
        return;
      }
      list.innerHTML = "";
      if (!Array.isArray(users) || users.length === 0) {
        list.innerHTML = "<li>No other users online</li>";
        return;
      }

      // Sort users by activity
      const sortedUsers = sortUsersByActivity(users);

      sortedUsers.forEach((user) => {
        const btn = document.createElement("button");
        btn.textContent = user.nickname;
        btn.setAttribute("data-user-id", user.id);
        btn.className = "user-btn";

        // Restore highlight if it was previously highlighted
        if (highlightedUserIds.has(user.id.toString())) {
          btn.classList.add("new-message");
        }

        const li = document.createElement("li");
        li.appendChild(btn);
        list.appendChild(li);

        btn.addEventListener("click", () => {
          handleUserClick(user.id, user.nickname);
        });
      });
    })
    .catch((error) => {
      console.error("Error loading users:", error);
      const globalList = document.getElementById("global-user-list");
      const chatList = document.getElementById("user-list");
      const list = globalList || chatList;
      if (list) {
        list.innerHTML = "<li>Error loading users</li>";
      }
    });
}

// Handle user click from user list
function handleUserClick(userId, nickname) {
  highlightedUserIds.delete(userId.toString());

  // Remove new-message class from both global and chat lists
  const globalButton = document.querySelector(
    `#global-user-list .user-btn[data-user-id="${userId}"]`
  );
  const chatButton = document.querySelector(
    `#user-list .user-btn[data-user-id="${userId}"]`
  );
  if (globalButton) globalButton.classList.remove("new-message");
  if (chatButton) chatButton.classList.remove("new-message");

  const currentPage = window.location.hash.substring(1);
  if (currentPage !== "chat") {
    sessionStorage.setItem(
      "pendingChatUser",
      JSON.stringify({
        id: userId,
        nickname: nickname,
      })
    );

    // Need to navigate to chat - this will be handled by the router
    window.dispatchEvent(new CustomEvent("navigateToChat"));
    return;
  }

  fetch(`/api/chat?user=${userId}`, { credentials: "include" })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      return res.json();
    })
    .then((data) => {
      if (data.success) {
        openChat(userId, nickname, data.chatId);
      }
    })
    .catch((error) => {
      console.error("Error opening chat:", error);
    });
}

// Check for pending chat user when navigating to chat page
export function checkPendingChatUser() {
  console.log("🔍 Checking for pending chat user...");
  const pendingUser = sessionStorage.getItem("pendingChatUser");
  if (pendingUser) {
    try {
      const user = JSON.parse(pendingUser);
      sessionStorage.removeItem("pendingChatUser");
      console.log("📝 Found pending chat user:", user);

      // Small delay to ensure chat page is fully loaded
      setTimeout(() => {
        fetch(`/api/chat?user=${user.id}`, { credentials: "include" })
          .then((res) => {
            if (!res.ok) {
              throw new Error(`HTTP error! status: ${res.status}`);
            }
            return res.json();
          })
          .then((data) => {
            console.log("Chat response:", data);
            if (data.success) {
              openChat(user.id, user.nickname, data.chatId);
            }
          })
          .catch((error) => {
            console.error("Error opening pending chat:", error);
          });
      }, 100);
    } catch (e) {
      console.error("Error parsing pending chat user:", e);
    }
  }
}

// Highlight user for new messages
function highlightUser(userId) {
  highlightedUserIds.add(userId.toString());
  // Update UI immediately if button exists
  const globalButton = document.querySelector(
    `#global-user-list .user-btn[data-user-id="${userId}"]`
  );
  const chatButton = document.querySelector(
    `#user-list .user-btn[data-user-id="${userId}"]`
  );
  if (globalButton && !globalButton.classList.contains("new-message")) {
    globalButton.classList.add("new-message");
  }
  if (chatButton && !chatButton.classList.contains("new-message")) {
    chatButton.classList.add("new-message");
  }
}

// Initialize chat WebSocket
function initChatWebSocket() {
  if (chatSocket) return;

  chatSocket = new WebSocket(`ws://${window.location.host}/ws`);

  chatSocket.onopen = () => {
    console.log("Chat WebSocket connected");
  };

  chatSocket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log("Received WebSocket message:", data);

      if (data.type === "message") {
        // Always update conversation order when receiving a message
        updateConversationOrder(data.sender_id, data.time, true);

        if (data.chatId === currentChatId) {
          // Message is for current chat - display it
          displayMessage(data);
        } else {
          // Message is for different chat - highlight user
          highlightUser(data.sender_id);
        }

        // Always refresh user list to show new order
        loadUsers();
        hideTypingIndicator();
      } else if (data.type === "typing") {
        console.log("📝 Received typing indicator:", data);
        if (data.chatId === currentChatId && data.senderId !== currentUserId) {
          console.log("✅ Showing typing indicator for:", data.senderName);
          showTypingIndicator(data.senderName || "Someone");
        }
      } else if (data.type === "stop_typing") {
        console.log("🛑 Received stop typing:", data);
        if (data.chatId === currentChatId && data.senderId !== currentUserId) {
          console.log("✅ Hiding typing indicator");
          hideTypingIndicator();
        }
      } else if (data.type === "presence_update") {
        // Reload users when someone comes online/offline
        loadUsers();
      }
    } catch (error) {
      console.error("Error parsing WebSocket message:", error);
    }
  };
}

// Setup typing indicator
function setupTypingIndicator() {
  const messageInput = document.getElementById("messageInput");
  if (!messageInput) {
    console.log(
      "ℹ️ messageInput element not found - skipping typing indicator setup"
    );
    return;
  }

  // Check if already set up to prevent duplicates
  if (
    messageInput.hasAttribute("data-typing-setup") &&
    messageInput.getAttribute("data-typing-setup") === "true"
  ) {
    console.log("ℹ️ Typing indicator already set up for this input");
    return;
  }

  // Mark as set up
  messageInput.setAttribute("data-typing-setup", "true");

  messageInput.addEventListener("input", () => {
    console.log("📝 Input event triggered");

    if (!chatSocket || !currentReceiverId || !currentChatId) {
      console.log("❌ Missing data for typing indicator");
      return;
    }

    // Send typing notification
    const typingData = {
      type: "typing",
      chatId: currentChatId,
      receiverId: currentReceiverId,
      senderId: currentUserId,
      senderName: "You",
    };

    console.log("📤 Sending typing notification:", typingData);
    chatSocket.send(JSON.stringify(typingData));

    // Clear existing timeout
    clearTimeout(typingTimeout);

    // Set timeout to stop typing after 3 seconds of inactivity
    typingTimeout = setTimeout(() => {
      const stopTypingData = {
        type: "stop_typing",
        chatId: currentChatId,
        receiverId: currentReceiverId,
        senderId: currentUserId,
      };

      console.log("📤 Sending stop typing notification:", stopTypingData);
      chatSocket.send(JSON.stringify(stopTypingData));
    }, 3000);
  });

  // Stop typing when user stops typing (blur event)
  messageInput.addEventListener("blur", () => {
    if (chatSocket && currentReceiverId && currentChatId) {
      const stopTypingData = {
        type: "stop_typing",
        chatId: currentChatId,
        receiverId: currentReceiverId,
        senderId: currentUserId,
      };

      console.log("📤 Sending stop typing on blur:", stopTypingData);
      chatSocket.send(JSON.stringify(stopTypingData));

      clearTimeout(typingTimeout);
    }
  });
}

// Show typing indicator
function showTypingIndicator(name) {
  const indicator = document.getElementById("typing-indicator");
  if (indicator) {
    console.log("🔔 showTypingIndicator called for:", name);
    indicator.textContent = `${name} is typing...`;
    indicator.classList.remove("hidden");

    // Scroll to bottom to show typing indicator
    const messagesOutput = document.getElementById("messagesOutput");
    if (messagesOutput) {
      messagesOutput.scrollTop = messagesOutput.scrollHeight;
    }
  }
}

// Hide typing indicator
function hideTypingIndicator() {
  const indicator = document.getElementById("typing-indicator");
  if (indicator) {
    console.log("🔔 hideTypingIndicator called");
    indicator.classList.add("hidden");
  }
}

// Open chat with a specific user
function openChat(receiverId, receiverName, chatId) {
  // Reset cooldown state for new chat
  lastLoadTime = 0;
  isLoadingCooldown = false;

  currentChatId = chatId;
  currentReceiverId = receiverId;
  currentReceiverName = receiverName;

  // Reset chat state for new chat
  chatMessages = [];
  allMessagesLoaded = false;
  earliestMessageId = null;
  loadingMessages = false;

  const chatWindow = document.getElementById("active-chat-window");
  const chatWithName = document.getElementById("chatWithName");
  const messagesOutput = document.getElementById("messagesOutput");
  const typingIndicator = document.getElementById("typing-indicator");

  if (chatWindow) chatWindow.classList.remove("hidden");
  if (chatWithName) chatWithName.textContent = `Chat with ${receiverName}`;
  if (messagesOutput) messagesOutput.innerHTML = "";
  if (typingIndicator) typingIndicator.classList.add("hidden");

  // Setup typing indicator for this chat
  setupTypingIndicator();

  // Load initial messages
  console.log("🚀 Opening new chat, loading initial messages...");
  loadChatMessages(receiverId, 10, null, true); 

  // Setup scroll loading for chat messages
  setupChatScrollLoading(receiverId);
}

let lastLoadTime = 0;
const LOAD_COOLDOWN = 3000; 
const MESSAGES_PER_LOAD = 10;
let isLoadingCooldown = false;

// Better throttle implementation with cooldown
function createScrollThrottle(fn, wait = 300) {
  let timeoutId = null;
  let lastCallTime = 0;

  return function (...args) {
    const now = Date.now();

    // Clear existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    const timeSinceLastCall = now - lastCallTime;

    if (timeSinceLastCall >= wait) {
      // Execute immediately
      lastCallTime = now;
      fn.apply(this, args);
    } else {
      // Schedule execution
      timeoutId = setTimeout(() => {
        lastCallTime = Date.now();
        fn.apply(this, args);
        timeoutId = null;
      }, wait - timeSinceLastCall);
    }
  };
}

// Enhanced setup with cooldown and message-based loading
function setupChatScrollLoading(receiverId) {
  const messagesOutput = document.getElementById("messagesOutput");
  if (!messagesOutput) return;

  // Remove existing handler
  if (messagesOutput._scrollHandler) {
    messagesOutput.removeEventListener("scroll", messagesOutput._scrollHandler);
  }

  const scrollHandler = createScrollThrottle(function () {
    const scrollTop = messagesOutput.scrollTop;
    const currentTime = Date.now();

    console.log("🔄 Scroll check:", {
      scrollTop,
      loadingMessages,
      allMessagesLoaded,
      isLoadingCooldown,
      timeSinceLastLoad: currentTime - lastLoadTime,
      messagesCount: chatMessages.length,
    });

    // Check if we're at the top AND not in cooldown AND have enough messages
    if (
      scrollTop <= 100 &&
      !allMessagesLoaded &&
      !loadingMessages &&
      !isLoadingCooldown &&
      chatMessages.length >= MESSAGES_PER_LOAD && // Only load if we have at least 10 messages
      currentTime - lastLoadTime >= LOAD_COOLDOWN
    ) {
      console.log("📥 Loading more messages...");

      // Set cooldown
      isLoadingCooldown = true;
      lastLoadTime = currentTime;

      // Load messages
      loadChatMessages(receiverId, 10, earliestMessageId)
        .then(() => {
          // Reset cooldown after successful load
          setTimeout(() => {
            isLoadingCooldown = false;
            console.log("✅ Load cooldown reset");
          }, LOAD_COOLDOWN);
        })
        .catch(() => {
          // Reset cooldown even on error
          setTimeout(() => {
            isLoadingCooldown = false;
            console.log("❌ Load cooldown reset (error)");
          }, 3000); // Shorter cooldown on error
        });
    } else if (scrollTop <= 100) {
      // Log why we didn't load
      const reasons = [];
      if (allMessagesLoaded) reasons.push("all messages loaded");
      if (loadingMessages) reasons.push("already loading");
      if (isLoadingCooldown) reasons.push("in cooldown");
      if (chatMessages.length < MESSAGES_PER_LOAD)
        reasons.push(`only ${chatMessages.length} messages`);
      if (currentTime - lastLoadTime < LOAD_COOLDOWN)
        reasons.push(
          `cooldown: ${Math.ceil(
            (LOAD_COOLDOWN - (currentTime - lastLoadTime)) / 1000
          )}s left`
        );

      console.log("⏳ Not loading:", reasons.join(", "));
    }
  }, 500); 

  messagesOutput._scrollHandler = scrollHandler;
  messagesOutput.addEventListener("scroll", scrollHandler);
}
// Load chat messages
function loadChatMessages(
  receiverId,
  limit = 10,
  before = null,
  isInitialLoad = false
) {
  console.log("📨 Loading chat messages:", {
    receiverId,
    before,
    limit,
    isInitialLoad,
    currentMessagesCount: chatMessages.length,
  });

  if (loadingMessages) {
    console.log("⏳ Already loading messages, skipping...");
    return Promise.resolve();
  }

  loadingMessages = true;

  let url = `/api/chat/history?receiverId=${receiverId}&limit=${limit}`;
  if (before) url += `&before=${before}`;

  const messagesOutput = document.getElementById("messagesOutput");
  let loadingIndicator = null;

  if (!isInitialLoad && messagesOutput) {
    loadingIndicator = document.createElement("div");
    loadingIndicator.className = "loading-indicator";
    loadingIndicator.innerHTML = `
      <div style="text-align: center; padding: 10px; color: #666; font-style: italic; background: #f9f9f9; border-radius: 5px; margin: 5px 0;">
        Loading more messages... 
        <small style="display: block; margin-top: 5px; font-size: 0.8em;">
          (Next load available in 10 seconds)
        </small>
      </div>
    `;
    messagesOutput.insertBefore(loadingIndicator, messagesOutput.firstChild);
  }

  return fetch(url, { credentials: "include" })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      return res.json();
    })
    .then((data) => {
      console.log("📨 Chat history response:", {
        success: data.success,
        messageCount: data.messages?.length || 0,
        totalMessagesNow: chatMessages.length,
      });

      if (loadingIndicator && loadingIndicator.parentNode) {
        loadingIndicator.remove();
      }

      if (data.success && messagesOutput && data.messages) {
        if (data.messages.length < limit) {
          allMessagesLoaded = true;
          console.log("✅ All messages loaded");
        }

        if (data.messages.length > 0) {
          if (isInitialLoad) {
            chatMessages = deduplicateMessages([...data.messages].reverse());
            earliestMessageId = chatMessages[0]?.id;
            renderAllChatMessages();
            setTimeout(() => {
              messagesOutput.scrollTop = messagesOutput.scrollHeight;
            }, 50);
          } else {
            const olderMessages = [...data.messages].reverse();
            const existingIds = new Set(chatMessages.map((msg) => msg.id));
            const uniqueOlderMessages = olderMessages.filter(
              (msg) => !existingIds.has(msg.id)
            );

            if (uniqueOlderMessages.length > 0) {
              earliestMessageId = uniqueOlderMessages[0]?.id;
              const prevScrollHeight = messagesOutput.scrollHeight;
              chatMessages = [...uniqueOlderMessages, ...chatMessages];
              chatMessages = deduplicateMessages(chatMessages);
              renderAllChatMessages();
              setTimeout(() => {
                const newScrollHeight = messagesOutput.scrollHeight;
                const scrollDiff = newScrollHeight - prevScrollHeight;
                messagesOutput.scrollTop = scrollDiff;
              }, 50);

              console.log(
                `✅ Added ${uniqueOlderMessages.length} older messages`
              );
            } else {
              console.log("⚠️ No unique messages to prepend.");
            }
          }
        } else {
          console.log("ℹ️ No new messages to load");
        }
      }
    })
    .catch((error) => {
      console.error("❌ Error loading chat history:", error);
      if (loadingIndicator && loadingIndicator.parentNode) {
        loadingIndicator.remove();
      }
      if (messagesOutput) {
        const errorDiv = document.createElement("div");
        errorDiv.className = "error-message";
        errorDiv.textContent =
          "Failed to load messages. Try again in a few seconds.";
        errorDiv.style.cssText =
          "color: red; text-align: center; padding: 10px; background: #ffe6e6; border-radius: 5px; margin: 5px 0;";

        if (isInitialLoad) {
          messagesOutput.innerHTML = "";
          messagesOutput.appendChild(errorDiv);
        } else {
          messagesOutput.insertBefore(errorDiv, messagesOutput.firstChild);
        }
      }
      throw error; // Re-throw to handle in setupChatScrollLoading
    })
    .finally(() => {
      loadingMessages = false;
    });
}

// Display a message in the chat window
function displayMessage(data) {
  console.log("💬 Displaying new message:", data);

  const newMessage = {
    id: data.id,
    chat_id: data.chatId,
    sender_id: data.sender_id,
    sender_name: data.sender_name,
    message: data.message,
    time: data.time,
  };

  if (!chatMessages.some((msg) => msg.id === newMessage.id)) {
    chatMessages.push(newMessage);
    chatMessages = deduplicateMessages(chatMessages);
    renderAllChatMessages();

    const messagesOutput = document.getElementById("messagesOutput");
    if (messagesOutput) {
      setTimeout(() => {
        messagesOutput.scrollTop = messagesOutput.scrollHeight;
      }, 50);
    }
  } else {
    console.log("🔁 Skipping duplicate message ID:", newMessage.id);
  }
}

/* 
function debugMessageRendering(msg, isFromCurrentUser) {
  console.log('🐛 Message debug:', {
    messageId: msg.id,
    senderId: msg.sender_id,
    senderIdType: typeof msg.sender_id,
    currentUserId: currentUserId,
    currentUserIdType: typeof currentUserId,
    isFromCurrentUser: isFromCurrentUser,
    comparison: msg.sender_id === currentUserId,
    stringComparison: String(msg.sender_id) === String(currentUserId)
  });
}
 */

// Fixed renderAllChatMessages function
function renderAllChatMessages() {
  
  const messagesOutput = document.getElementById("messagesOutput");
  if (!messagesOutput) return;

  console.log("🎨 Rendering", chatMessages.length, "messages in chronological order");


  // Clear existing messages
  messagesOutput.innerHTML = "";

  // Sort messages by ID to ensure chronological order (oldest first)
  const sortedMessages = [...chatMessages].sort((a, b) => {
    return parseInt(a.id) - parseInt(b.id);
  });

  // Render all messages in chronological order
  sortedMessages.forEach((msg, index) => {
    const div = document.createElement("div");
    
    // Convert both to strings for comparison to avoid type issues
    const isFromCurrentUser = msg.sender_id === currentUserId;
    
   /*  // Debug each message
    debugMessageRendering(msg, isFromCurrentUser); */

    div.className = `chat-message ${isFromCurrentUser ? "outgoing" : "incoming"}`;
    div.setAttribute("data-message-id", msg.id);
    div.setAttribute("data-message-index", index);

    div.innerHTML = `
      <div class="message-content">
        <strong>${msg.sender_name}:</strong> ${msg.message}
      </div>
      <div class="message-time">${formatTime(msg.time)}</div>
    `;

    messagesOutput.appendChild(div);
  });

  console.log("✅ Rendered all messages in chronological order (oldest to newest)");
}



// Send message function
export function sendMessage() {
  const input = document.getElementById("messageInput");
  const message = input?.value.trim();

  if (!message || !chatSocket || !currentChatId || !currentReceiverId) {
    console.log("❌ Missing required data for sending message");
    return;
  }

  // Stop typing indicator when sending message
  clearTimeout(typingTimeout);
  if (chatSocket && currentReceiverId && currentChatId) {
    chatSocket.send(
      JSON.stringify({
        type: "stop_typing",
        chatId: currentChatId,
        receiverId: currentReceiverId,
        senderId: currentUserId,
      })
    );
  }

  const messageData = {
    type: "message",
    chatId: currentChatId,
    receiverId: currentReceiverId,
    message: message,
  };

  console.log("📤 Sending message:", messageData);
  chatSocket.send(JSON.stringify(messageData));

  input.value = "";

  // Update conversation order immediately after sending
  updateConversationOrder(currentReceiverId, new Date().toISOString(), true);

  // Refresh user list to show updated order
  loadUsers();
}

// Cleanup chat when logging out
export function cleanupChat() {
  if (chatSocket) {
    chatSocket.close();
    chatSocket = null;
  }

  // Reset all chat variables
  currentChatId = null;
  currentReceiverId = null;
  currentReceiverName = null;
  currentUserId = null;
  typingTimeout = null;
  allMessagesLoaded = false;
  earliestMessageId = null;
  chatMessages = [];
  loadingMessages = false;
  highlightedUserIds.clear();
}

// Handle chat socket reconnection
export function handleChatSocketReconnect(isAuthenticated) {
  if (isAuthenticated) {
    initChatWebSocket();
  }
}

// Utility functions
function deduplicateMessages(messagesArray) {
  const seenIds = new Set();
  return messagesArray.filter((msg) => {
    if (seenIds.has(msg.id)) return false;
    seenIds.add(msg.id);
    return true;
  });
}

function formatTime(timeStr) {
  try {
    const date = new Date(timeStr);
    return date.toLocaleString([], {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (e) {
    return timeStr;
  }
}

function saveConversationData() {
  localStorage.setItem("conversationOrder", JSON.stringify(conversationOrder));
  localStorage.setItem("userHasMessages", JSON.stringify(userHasMessages));
  localStorage.setItem("lastMessageTimes", JSON.stringify(lastMessageTimes));
}

function sortUsersByActivity(users) {

  return users.sort((a, b) => {
    const aHasMessages = userHasMessages[a.id] || false;
    const bHasMessages = userHasMessages[b.id] || false;
    const aTime = lastMessageTimes[a.id];
    const bTime = lastMessageTimes[b.id];


    // Both have message history: sort by most recent message
    if (aHasMessages && bHasMessages && aTime && bTime) {
      const result = new Date(bTime) - new Date(aTime);
      console.log(
        `Both have messages, sorting by time: ${
          result > 0 ? b.nickname : a.nickname
        } first`
      );
      return result;
    }

    // Only one has message history: prioritize them
    if (aHasMessages && !bHasMessages) {
      console.log(
        `${a.nickname} has messages, ${b.nickname} doesn't - ${a.nickname} first`
      );
      return -1;
    }
    if (!aHasMessages && bHasMessages) {
      console.log(
        `${b.nickname} has messages, ${a.nickname} doesn't - ${b.nickname} first`
      );
      return 1;
    }

    // Both have message history but missing timestamps: use conversationOrder
    if (aHasMessages && bHasMessages) {
      const aIndex = conversationOrder.indexOf(a.id);
      const bIndex = conversationOrder.indexOf(b.id);
      if (aIndex !== -1 && bIndex !== -1) {
        console.log(
          `Using conversation order: ${
            aIndex < bIndex ? a.nickname : b.nickname
          } first`
        );
        return aIndex - bIndex;
      }
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
    }
    return a.nickname.localeCompare(b.nickname);
  });
}

function updateConversationOrder(
  userId,
  messageTime = null,
  isNewMessage = true
) {
  console.log(`📊 Updating conversation order for user ${userId}`);

  if (isNewMessage) {
    userHasMessages[userId] = true;
  }

  // Remove user from current position
  const currentIndex = conversationOrder.indexOf(userId);
  if (currentIndex !== -1) {
    conversationOrder.splice(currentIndex, 1);
  }

  // Add to top of list
  conversationOrder.unshift(userId);

  // Update last message time
  lastMessageTimes[userId] = messageTime || new Date().toISOString();

  // Save to localStorage
  saveConversationData();

  console.log(`✅ Updated conversation order:`, conversationOrder);
}
