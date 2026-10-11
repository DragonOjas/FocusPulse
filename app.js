// ================= CONFIGURATION =================
const STORAGE_KEYS = {
  TASKS: "focuspulse_tasks",
  MINUTES: "focuspulse_minutes",
  SCREEN_HOURS: "focuspulse_screen_hours",
  STREAK: "focuspulse_streak",
  LAST_ACTIVE: "focuspulse_last_active",
  HEATMAP: "focuspulse_heatmap"
};

const SUBJECT_COLORS = {
  "Physics": "#3b82f6",
  "Maths": "#10b981",
  "Chemistry": "#f59e0b",
  "Biology": "#ec4899",
  "Computer Science": "#8b5cf6",
  "General": "#64748b"
};

// Application State
let tasks = JSON.parse(localStorage.getItem(STORAGE_KEYS.TASKS)) || [];
let totalMinutesStudied = parseInt(localStorage.getItem(STORAGE_KEYS.MINUTES), 10) || 0;
let screenHours = parseFloat(localStorage.getItem(STORAGE_KEYS.SCREEN_HOURS)) || 0.0;
let streakDays = parseInt(localStorage.getItem(STORAGE_KEYS.STREAK), 10) || 0;
let lastActiveDate = localStorage.getItem(STORAGE_KEYS.LAST_ACTIVE) || null;
let activityHistory = JSON.parse(localStorage.getItem(STORAGE_KEYS.HEATMAP)) || {};
let currentFilter = "all";

// Timer Engine State
let timerInitial = 25 * 60;
let timerSeconds = timerInitial;
let timerInterval = null;
let isTimerRunning = false;
let audioCtx = null;

// DOM Elements Cache
const taskListEl = document.getElementById("task-list");
const taskForm = document.getElementById("task-form");
const tasksStatEl = document.getElementById("tasks-stat");
const progressFillEl = document.getElementById("progress-fill");
const timeStatEl = document.getElementById("time-stat");
const riskStatEl = document.getElementById("risk-stat");
const screenTimeTextEl = document.getElementById("screen-time-text");
const burnoutBadgeEl = document.getElementById("burnout-badge");
const streakCounterEl = document.getElementById("streak-counter");
const adviceTextEl = document.getElementById("advice-text");
const timerDisplayEl = document.getElementById("timer-display");
const startTimerBtn = document.getElementById("start-timer-btn");
const pauseTimerBtn = document.getElementById("pause-timer-btn");
const resetTimerBtn = document.getElementById("reset-timer-btn");
const presetButtons = document.querySelectorAll(".preset-btn");
const filterButtons = document.querySelectorAll(".filter-btn");
const screentimeInput = document.getElementById("screentime-input");
const updateScreentimeBtn = document.getElementById("update-screentime-btn");
const heatmapGrid = document.getElementById("heatmap-grid");
const heatmapMonths = document.getElementById("heatmap-months");
const heatmapSubtext = document.getElementById("heatmap-subtext");
const demoBtn = document.getElementById("demo-btn");
const resetAllBtn = document.getElementById("reset-all-btn");
const navTabs = document.querySelectorAll(".nav-tab");
const viewPanels = document.querySelectorAll(".view-panel");
const downloadTxtBtn = document.getElementById("download-txt-btn");

// Focus AI Elements
const aiChatForm = document.getElementById("ai-chat-form");
const aiUserPrompt = document.getElementById("ai-user-prompt");
const chatMessages = document.getElementById("chat-messages");
const clearChatBtn = document.getElementById("clear-chat-btn");
const quickAiPlanBtn = document.getElementById("quick-ai-plan-btn");
const quickAiBurnoutBtn = document.getElementById("quick-ai-burnout-btn");
const aiGenerateSummaryBtn = document.getElementById("ai-generate-summary-btn");
const aiSummaryBody = document.getElementById("ai-summary-body");
const actionBreakdownBtn = document.getElementById("action-breakdown-btn");
const actionQuizBtn = document.getElementById("action-quiz-btn");
const actionFatigueBtn = document.getElementById("action-fatigue-btn");
const actionStrategyBtn = document.getElementById("action-strategy-btn");
const apiStatusBadge = document.getElementById("api-status-badge");
const apiStatusNote = document.getElementById("api-status-note");

// ================= APP INITIALIZATION =================
document.addEventListener("DOMContentLoaded", () => {
  validateStreakOnStartup();
  renderDate();
  renderTasks();
  buildGitHubHeatmap();
  updateMetrics();
  updateTimerDisplay();
  setupEventListeners();
  renderReportView();
  if (screentimeInput) screentimeInput.value = screenHours;
  updateApiBadgeState();
});

function getIsoDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function renderDate() {
  const now = new Date();
  const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
  const el = document.getElementById("current-date");
  if (el) el.textContent = now.toLocaleDateString(undefined, options);
}

async function updateApiBadgeState() {
  if (!apiStatusBadge) return;
  apiStatusBadge.className = "badge badge-warning";
  apiStatusBadge.textContent = "Checking AI...";

  try {
    const response = await fetch("/api/health");
    const status = response.ok ? await response.json() : { aiConfigured: false };
    if (status.aiConfigured) {
      apiStatusBadge.className = "badge badge-safe";
      apiStatusBadge.textContent = "Groq Active";
      if (apiStatusNote) apiStatusNote.textContent = "Live AI responses are securely proxied by the app server.";
      return;
    }
  } catch (error) {
    console.warn("AI service status check failed:", error);
  }

  apiStatusBadge.className = "badge badge-warning";
  apiStatusBadge.textContent = "Offline Mode";
  if (apiStatusNote) apiStatusNote.textContent = "Offline mentor responses are active. Configure GROQ_API_KEY on the app server for live AI.";
}

// ================= STREAK & CALENDAR ENGINE =================
function validateStreakOnStartup() {
  const today = getIsoDate();
  if (!lastActiveDate) {
    streakDays = 0;
  } else {
    const diff = Math.floor((new Date(today) - new Date(lastActiveDate)) / (1000 * 60 * 60 * 24));
    if (diff > 1) {
      streakDays = 0;
      localStorage.setItem(STORAGE_KEYS.STREAK, 0);
    }
  }
  if (streakCounterEl) streakCounterEl.textContent = `🔥 ${streakDays} Day Streak`;
}

function registerActivity() {
  const today = getIsoDate();

  if (lastActiveDate !== today) {
    if (!lastActiveDate) {
      streakDays = 1;
    } else {
      const diff = Math.floor((new Date(today) - new Date(lastActiveDate)) / (1000 * 60 * 60 * 24));
      if (diff === 1) streakDays += 1;
      else if (diff > 1) streakDays = 1;
    }
    lastActiveDate = today;
    localStorage.setItem(STORAGE_KEYS.STREAK, streakDays);
    localStorage.setItem(STORAGE_KEYS.LAST_ACTIVE, lastActiveDate);
  }

  activityHistory[today] = (activityHistory[today] || 0) + 1;
  localStorage.setItem(STORAGE_KEYS.HEATMAP, JSON.stringify(activityHistory));

  if (streakCounterEl) streakCounterEl.textContent = `🔥 ${streakDays} Day Streak`;
  buildGitHubHeatmap();
  renderReportView();
}

// ================= 28-WEEK GITHUB HEATMAP =================
function buildGitHubHeatmap() {
  if (!heatmapGrid || !heatmapMonths) return;
  heatmapGrid.innerHTML = "";
  heatmapMonths.innerHTML = "";

  const TOTAL_WEEKS = 28;
  const today = new Date();
  const todayIso = getIsoDate(today);

  const currentDayOfWeek = today.getDay();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - currentDayOfWeek - (TOTAL_WEEKS - 1) * 7);

  let totalActiveUnits = 0;
  let lastMonth = -1;
  const monthLabelsTrack = [];

  for (let w = 0; w < TOTAL_WEEKS; w++) {
    const weekStartDate = new Date(startDate);
    weekStartDate.setDate(startDate.getDate() + w * 7);
    const m = weekStartDate.getMonth();

    if (m !== lastMonth) {
      monthLabelsTrack.push({ weekIndex: w, monthName: weekStartDate.toLocaleDateString(undefined, { month: 'short' }) });
      lastMonth = m;
    }

    for (let d = 0; d < 7; d++) {
      const cellDate = new Date(startDate);
      cellDate.setDate(startDate.getDate() + (w * 7) + d);
      const isoKey = getIsoDate(cellDate);
      const count = activityHistory[isoKey] || 0;
      totalActiveUnits += count;

      let level = "level-0";
      if (count === 1) level = "level-1";
      else if (count === 2) level = "level-2";
      else if (count === 3) level = "level-3";
      else if (count >= 4) level = "level-4";

      const isFuture = cellDate > today;
      const cell = document.createElement("div");
      cell.className = `gh-cell ${isFuture ? 'level-0' : level} ${isoKey === todayIso ? 'is-today' : ''}`;
      
      if (!isFuture) {
        cell.title = `${isoKey}: ${count} study blocks / tasks`;
      }

      heatmapGrid.appendChild(cell);
    }
  }

  const colWidth = 14;
  monthLabelsTrack.forEach(item => {
    const span = document.createElement("span");
    span.className = "month-label";
    span.textContent = item.monthName;
    span.style.width = `${colWidth * 4.2}px`;
    heatmapMonths.appendChild(span);
  });

  if (heatmapSubtext) {
    heatmapSubtext.textContent = `${totalActiveUnits} contribution points across past 28 weeks`;
  }
}

// ================= OFFLINE AUDIO CHIME =================
function playChime() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
    osc.frequency.setValueAtTime(880.00, audioCtx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.8);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.8);
  } catch (e) {
    console.warn("Web Audio API blocked or unavailable:", e);
  }
}

// ================= EVENT LISTENERS =================
function setupEventListeners() {
  if (taskForm) taskForm.addEventListener("submit", handleAddTask);
  if (startTimerBtn) startTimerBtn.addEventListener("click", startTimer);
  if (pauseTimerBtn) pauseTimerBtn.addEventListener("click", pauseTimer);
  if (resetTimerBtn) resetTimerBtn.addEventListener("click", resetTimer);

  presetButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      presetButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const mins = parseInt(btn.dataset.time, 10);
      timerInitial = mins * 60;
      timerSeconds = timerInitial;
      pauseTimer();
      updateTimerDisplay();
    });
  });

  filterButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      filterButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.dataset.filter;
      renderTasks();
    });
  });

  if (updateScreentimeBtn) {
    updateScreentimeBtn.addEventListener("click", () => {
      const val = parseFloat(screentimeInput.value);
      screenHours = isNaN(val) || val < 0 ? 0 : val;
      localStorage.setItem(STORAGE_KEYS.SCREEN_HOURS, screenHours);
      updateMetrics();
      renderReportView();
    });
  }

  navTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      navTabs.forEach(t => t.classList.remove("active"));
      viewPanels.forEach(p => p.classList.remove("active"));
      tab.classList.add("active");
      const targetView = document.getElementById(tab.dataset.view);
      if (targetView) targetView.classList.add("active");
      if (tab.dataset.view === "report-view") renderReportView();
    });
  });

  // Focus AI Listeners
  if (aiChatForm) aiChatForm.addEventListener("submit", handleChatSubmit);
  if (clearChatBtn) {
    clearChatBtn.addEventListener("click", () => {
      if (chatMessages) {
        chatMessages.innerHTML = `
          <div class="chat-bubble ai-bubble">
            <div class="bubble-header"><strong>Focus AI</strong><span class="timestamp">Ready</span></div>
            <p>Chat cleared. How can I assist your revision strategy?</p>
          </div>`;
      }
    });
  }

  if (actionBreakdownBtn) {
    actionBreakdownBtn.addEventListener("click", () => {
      promptAndDecompose("Optics: Wave theory and Ray diagrams", "Physics");
    });
  }

  if (actionQuizBtn) {
    actionQuizBtn.addEventListener("click", () => {
      triggerAiPrompt("Generate a rapid 3-question active recall test on High School Chemistry (Organic mechanisms) with hidden answers.");
    });
  }

  if (actionFatigueBtn) {
    actionFatigueBtn.addEventListener("click", () => {
      triggerAiBurnoutDiagnostic();
    });
  }

  if (actionStrategyBtn) {
    actionStrategyBtn.addEventListener("click", () => {
      triggerAiPrompt(`Looking at my tasks: ${tasks.map(t => t.title).join(", ")}, recommend the single best task to tackle first and why using the Pomodoro method.`);
    });
  }

  if (quickAiPlanBtn) {
    quickAiPlanBtn.addEventListener("click", () => {
      const topic = prompt("Enter a chapter/topic to auto-decompose into 3 actionable tasks (e.g. 'Photosynthesis and Light Reactions'):");
      if (topic) promptAndDecompose(topic, "Biology");
    });
  }

  if (quickAiBurnoutBtn) quickAiBurnoutBtn.addEventListener("click", triggerAiBurnoutDiagnostic);
  if (aiGenerateSummaryBtn) aiGenerateSummaryBtn.addEventListener("click", generateAiReportAudit);
  if (demoBtn) demoBtn.addEventListener("click", populateDemoData);
  if (resetAllBtn) resetAllBtn.addEventListener("click", resetAllData);
  if (downloadTxtBtn) downloadTxtBtn.addEventListener("click", exportDailySummary);
}

// ================= SECURE AI SERVICE PROXY =================
async function callAiMentor(promptText, systemInstruction = "") {
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: promptText, systemInstruction })
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || `AI service request failed (HTTP ${response.status}).`);
    }
    if (typeof result.reply !== "string" || !result.reply.trim()) {
      throw new Error("The AI service returned an empty response.");
    }
    return result.reply;
  } catch (error) {
    console.warn("AI service request failed:", error);
    return `⚠️ ${error.message || "The live AI service is unavailable."}\n\n*Using offline mentor response:*\n\n` + generateOfflineAiResponse(promptText);
  }
}

// ================= NATURAL OFFLINE RESPONSES =================
function generateOfflineAiResponse(prompt) {
  const p = prompt.toLowerCase().trim();

  if (p === "how are you" || p.includes("how are you")) {
    return `Hello! I'm operating at peak performance and ready to help you plan your revision. What chapter or subject are we working on right now?`;
  }

  if (p === "hi" || p === "hello" || p === "hey") {
    return `Hi there! Ready for a productive study session? Tell me what subject you're tackling, or click **"Decompose Syllabus Topic"** to build a revision checklist.`;
  }

  if (p.includes("who are you") || p.includes("what can you do")) {
    return `I am **Focus AI**, your built-in revision coach. I help you break down complex syllabus topics into 25-minute Pomodoro tasks, run quick active-recall quizzes, and monitor your study-to-screen ratio to prevent academic burnout.`;
  }

  if (p.includes("decompose") || p.includes("break down") || p.includes("subtask")) {
    return `### 🧩 Focus AI Topic Decomposition\nHere is your high-yield 3-step revision breakdown:\n1. **Core Conceptual Overview:** Read and diagram the foundational formulas and definitions (25m block).\n2. **Targeted Practice:** Solve 5 representative numericals or standard textbook questions (25m block).\n3. **Active Recall Summary:** Close notes and write down key laws and boundary conditions from memory (15m block).\n\n*Tasks have been organized for high retention!*`;
  }

  if (p.includes("quiz") || p.includes("recall") || p.includes("test")) {
    return `### 🎯 Focus AI Active Recall Quiz\nTest your knowledge without checking notes:\n1. **Question 1:** What is the primary difference between scalar and vector quantities in kinematics?\n2. **Question 2:** State the first law of thermodynamics in mathematical terms.\n3. **Question 3:** What is the limiting reagent in an equimolar reaction of A + 2B -> C?\n\n*Write down your answers, then spend 5 minutes reviewing any missed concepts!*`;
  }

  if (p.includes("fatigue") || p.includes("burnout") || p.includes("screen")) {
    const studyHours = (totalMinutesStudied / 60).toFixed(1);
    return `### 🧘 Focus AI Fatigue & Cognitive Analysis\n- **Current Study Load:** ${studyHours} hours\n- **Recreational Screen Exposure:** ${screenHours} hours\n\n**Diagnosis:** ${screenHours >= 4 ? "High Screen Strain" : "Healthy Cognitive Equilibrium"}.\n**Prescription:** Practice the **20-20-20 rule** (every 20 minutes, look at an object 20 feet away for 20 seconds). Hydrate immediately, and ensure your next study block is completed using physical notebooks instead of a display.`;
  }

  if (p.includes("audit") || p.includes("summary") || p.includes("report")) {
    const completed = tasks.filter(t => t.completed).length;
    return `**Focus AI Executive Summary:** Student demonstrates consistent discipline with a **${streakDays}-day active habit streak**. Current task completion efficiency stands at **${tasks.length ? Math.round((completed / tasks.length) * 100) : 0}%**. Recreational screen time is currently logged at ${screenHours} hrs against ${totalMinutesStudied} study minutes. Recommendation: Prioritize pending High-Priority tasks during the morning focus window.`;
  }

  return `### ⚡ Focus AI Study Insight\nHere is an optimized revision strategy for your query:\n- **Spaced Repetition:** Review the core definitions today, and re-test yourself in 48 hours.\n- **Feynman Technique:** Explain this concept in simple words out loud as if explaining it to a peer.\n- **Active Practice:** Pair this topic with a 25-minute Pomodoro study sprint.`;
}

// ================= AI CHAT & TASK INTEGRATION =================
async function handleChatSubmit(e) {
  e.preventDefault();
  const text = aiUserPrompt.value.trim();
  if (!text) return;

  appendChatBubble("user", text);
  aiUserPrompt.value = "";

  const loadingId = appendChatBubble("ai", "<em>Focus AI is preparing your response...</em>");
  const reply = await callAiMentor(text, "You are Focus AI, an encouraging and academically sharp study mentor for high school revision.");
  updateChatBubble(loadingId, reply);
}

function appendChatBubble(sender, content) {
  const id = "bubble-" + Date.now();
  const div = document.createElement("div");
  div.className = `chat-bubble ${sender === 'user' ? 'user-bubble' : 'ai-bubble'}`;
  div.id = id;

  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  div.innerHTML = `
    <div class="bubble-header">
      <strong>${sender === 'user' ? 'Student' : 'Focus AI ✨'}</strong>
      <span class="timestamp">${timeStr}</span>
    </div>
    <div class="bubble-text">${formatMarkdownText(content)}</div>
  `;

  if (chatMessages) {
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  return id;
}

function updateChatBubble(id, newContent) {
  const el = document.getElementById(id);
  if (el) {
    const textContainer = el.querySelector(".bubble-text");
    if (textContainer) textContainer.innerHTML = formatMarkdownText(newContent);
    if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
  }
}

function formatMarkdownText(text) {
  return text
    .replace(/^### (.*$)/gim, '<strong>$1</strong><br/>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>');
}

function triggerAiPrompt(promptText) {
  const aiTab = document.querySelector('.nav-tab[data-view="ai-view"]');
  if (aiTab) aiTab.click();
  if (aiUserPrompt && aiChatForm) {
    aiUserPrompt.value = promptText;
    aiChatForm.dispatchEvent(new Event("submit"));
  }
}

function triggerAiBurnoutDiagnostic() {
  const prompt = `Assess my cognitive fatigue based on ${totalMinutesStudied} minutes of study time and ${screenHours} hours of non-academic screen time. Provide clear, empathetic recovery steps.`;
  triggerAiPrompt(prompt);
}

async function promptAndDecompose(topic, defaultSubject = "General") {
  const aiTab = document.querySelector('.nav-tab[data-view="ai-view"]');
  if (aiTab) aiTab.click();

  appendChatBubble("user", `Decompose "${topic}" into actionable revision subtasks.`);
  const loadingId = appendChatBubble("ai", "<em>Decomposing syllabus with Focus AI...</em>");

  const prompt = `Decompose the study topic "${topic}" into 3 concrete, short revision subtasks. Return format: exactly 3 bullet points starting with a dash.`;
  const result = await callAiMentor(prompt);
  updateChatBubble(loadingId, result);

  const lines = result.split("\n").filter(l => l.trim().startsWith("-") || l.trim().match(/^\d+\./));
  if (lines.length > 0) {
    lines.slice(0, 3).forEach((line, idx) => {
      const cleanTitle = line.replace(/^[-*\d.]\s*/, '').replace(/\*\*/g, '').trim();
      if (cleanTitle) {
        tasks.unshift({
          id: Date.now() + idx,
          title: `[AI] ${cleanTitle}`,
          subject: defaultSubject,
          priority: idx === 0 ? "High" : "Medium",
          completed: false
        });
      }
    });
    saveTasks();
    renderTasks();
    updateMetrics();
    registerActivity();
  }
}

async function generateAiReportAudit() {
  if (!aiSummaryBody) return;
  aiSummaryBody.innerHTML = "<em>Focus AI is synthesizing study metrics and generating audit...</em>";
  const completed = tasks.filter(t => t.completed).length;
  const prompt = `Generate a concise executive revision audit for a high school student:
- Active Streak: ${streakDays} days
- Study Time: ${totalMinutesStudied} minutes
- Non-Academic Screen Hours: ${screenHours} hours
- Task Completion: ${completed} of ${tasks.length} tasks completed
- Tasks: ${tasks.map(t => t.title).join("; ")}
Provide a 3-sentence diagnostic assessment and one high-impact tip.`;

  const report = await callAiMentor(prompt);
  aiSummaryBody.innerHTML = formatMarkdownText(report);
}

// ================= TASK MANAGEMENT (CRUD) =================
function handleAddTask(e) {
  e.preventDefault();
  const title = document.getElementById("task-title").value.trim();
  const subject = document.getElementById("task-subject").value;
  const priority = document.getElementById("task-priority").value;

  if (!title || !subject) return;

  const newTask = {
    id: Date.now(),
    title,
    subject,
    priority,
    completed: false
  };

  tasks.unshift(newTask);
  saveTasks();
  renderTasks();
  updateMetrics();
  registerActivity();
  taskForm.reset();
}

function toggleTask(id) {
  tasks = tasks.map(task => {
    if (task.id === id) {
      const next = !task.completed;
      if (next) registerActivity();
      return { ...task, completed: next };
    }
    return task;
  });
  saveTasks();
  renderTasks();
  updateMetrics();
  renderReportView();
}

function deleteTask(id) {
  tasks = tasks.filter(task => task.id !== id);
  saveTasks();
  renderTasks();
  updateMetrics();
  renderReportView();
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
}

function renderTasks() {
  if (!taskListEl) return;
  taskListEl.innerHTML = "";

  const filteredTasks = tasks.filter(task => {
    if (currentFilter === "pending") return !task.completed;
    if (currentFilter === "completed") return task.completed;
    return true;
  });

  if (filteredTasks.length === 0) {
    taskListEl.innerHTML = `<li style="color: var(--text-muted); text-align: center; padding: 1.25rem;">No tasks in this view.</li>`;
    return;
  }

  filteredTasks.forEach(task => {
    const li = document.createElement("li");
    li.className = `task-item ${task.completed ? "completed" : ""}`;

    li.innerHTML = `
      <div class="task-main">
        <input type="checkbox" ${task.completed ? "checked" : ""} onchange="toggleTask(${task.id})" />
        <span class="task-text">${task.title}</span>
      </div>
      <div class="task-meta">
        <span class="tag-subject" style="border-left: 3px solid ${SUBJECT_COLORS[task.subject] || '#3b82f6'}">${task.subject}</span>
        <span class="priority-badge priority-${task.priority.toLowerCase()}">${task.priority}</span>
        <button class="delete-btn" onclick="deleteTask(${task.id})" title="Delete task">&times;</button>
      </div>
    `;

    taskListEl.appendChild(li);
  });
}

// ================= STUDY TIMER =================
function updateTimerDisplay() {
  if (!timerDisplayEl) return;
  const mins = Math.floor(timerSeconds / 60);
  const secs = timerSeconds % 60;
  timerDisplayEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function startTimer() {
  if (isTimerRunning) return;
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  isTimerRunning = true;
  timerInterval = setInterval(() => {
    if (timerSeconds > 0) {
      timerSeconds--;
      updateTimerDisplay();
    } else {
      clearInterval(timerInterval);
      isTimerRunning = false;
      playChime();

      const sessionMins = Math.floor(timerInitial / 60);
      totalMinutesStudied += sessionMins;
      localStorage.setItem(STORAGE_KEYS.MINUTES, totalMinutesStudied);

      registerActivity();
      updateMetrics();
      renderReportView();
      alert("Study session complete! 5-minute break started.");
      resetTimer();
    }
  }, 1000);
}

function pauseTimer() {
  clearInterval(timerInterval);
  isTimerRunning = false;
}

function resetTimer() {
  pauseTimer();
  timerSeconds = timerInitial;
  updateTimerDisplay();
}

// ================= BURNOUT & TELEMETRY =================
function updateMetrics() {
  const total = tasks.length;
  const completed = tasks.filter(t => t.completed).length;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

  if (tasksStatEl) tasksStatEl.textContent = `${completed} / ${total}`;
  if (progressFillEl) progressFillEl.style.width = `${pct}%`;
  if (timeStatEl) timeStatEl.textContent = `${totalMinutesStudied} min`;
  if (screenTimeTextEl) screenTimeTextEl.textContent = `Logged Screen Time: ${screenHours} hrs`;

  let riskLevel = "Low";
  let badgeClass = "badge-safe";
  let badgeText = "State: Balanced";
  let advice = "Optimal balance. Keep steady focus blocks with short breaks.";

  if (screenHours >= 5 || totalMinutesStudied >= 240) {
    riskLevel = "High";
    badgeClass = "badge-danger";
    badgeText = "State: High Fatigue Risk";
    advice = "High cognitive screen load detected. Mandatory offline break advised.";
  } else if (screenHours >= 3 || totalMinutesStudied >= 150) {
    riskLevel = "Moderate";
    badgeClass = "badge-warning";
    badgeText = "State: Take a Break Soon";
    advice = "Approaching eye/brain strain threshold. Stand up and stretch.";
  }

  if (riskStatEl) riskStatEl.textContent = riskLevel;
  if (burnoutBadgeEl) {
    burnoutBadgeEl.className = `badge ${badgeClass}`;
    burnoutBadgeEl.textContent = badgeText;
  }
  if (adviceTextEl) adviceTextEl.textContent = advice;
}

// ================= ANALYTICS & AUDIT VIEW =================
function renderReportView() {
  const total = tasks.length;
  const completed = tasks.filter(t => t.completed).length;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

  const compPctEl = document.getElementById("report-completion-pct");
  const compSubEl = document.getElementById("report-completion-sub");
  const streakValEl = document.getElementById("report-streak-val");
  const ratioValEl = document.getElementById("report-ratio-val");
  const ratioSubEl = document.getElementById("report-ratio-sub");

  if (compPctEl) compPctEl.textContent = `${pct}%`;
  if (compSubEl) compSubEl.textContent = `${completed} tasks completed out of ${total}`;
  if (streakValEl) streakValEl.textContent = `${streakDays} Days`;

  const studyHours = (totalMinutesStudied / 60).toFixed(1);
  const ratio = totalMinutesStudied === 0 ? 0 : (screenHours / (totalMinutesStudied / 60)).toFixed(1);
  if (ratioValEl) ratioValEl.textContent = `${ratio}x`;
  if (ratioSubEl) ratioSubEl.textContent = ratio > 1.5 ? "Screen heavy (Fatigue Alert)" : "Optimal balance";

  const diagStudyEl = document.getElementById("diag-study-hours");
  const diagScreenEl = document.getElementById("diag-screen-hours");
  const diagRec = document.getElementById("diag-recommendation");
  const diagSub = document.getElementById("diag-recommendation-sub");

  if (diagStudyEl) diagStudyEl.textContent = `${studyHours} hrs`;
  if (diagScreenEl) diagScreenEl.textContent = `${screenHours} hrs`;

  if (diagRec && diagSub) {
    if (screenHours >= 5 || totalMinutesStudied >= 240) {
      diagRec.textContent = "High Fatigue Risk";
      diagRec.style.color = "var(--danger)";
      diagSub.textContent = "Screen time or study load exceeded safe levels. Unplug for 30 minutes.";
    } else if (screenHours >= 3 || totalMinutesStudied >= 150) {
      diagRec.textContent = "Moderate Strain";
      diagRec.style.color = "var(--warning)";
      diagSub.textContent = "Approaching saturation. Switch to low-screen reading or physical notes.";
    } else {
      diagRec.textContent = "Cognitive State Balanced";
      diagRec.style.color = "var(--success)";
      diagSub.textContent = "Great job maintaining an active revision routine without excessive eye strain.";
    }
  }

  const subjectCounts = {};
  tasks.forEach(t => {
    subjectCounts[t.subject] = (subjectCounts[t.subject] || 0) + 1;
  });

  const barEl = document.getElementById("subject-stacked-bar");
  const legendEl = document.getElementById("subject-legend-grid");
  if (barEl && legendEl) {
    barEl.innerHTML = "";
    legendEl.innerHTML = "";

    if (total === 0) {
      barEl.innerHTML = `<div style="width: 100%; height: 100%; background: var(--bg-elevated);"></div>`;
      legendEl.innerHTML = `<span class="subtext">Add revision tasks to visualize subject distribution.</span>`;
    } else {
      Object.keys(subjectCounts).forEach(subj => {
        const count = subjectCounts[subj];
        const slicePct = ((count / total) * 100).toFixed(1);
        const color = SUBJECT_COLORS[subj] || "#3b82f6";

        const slice = document.createElement("div");
        slice.className = "subject-bar-slice";
        slice.style.width = `${slicePct}%`;
        slice.style.backgroundColor = color;
        slice.title = `${subj}: ${slicePct}% (${count} tasks)`;
        barEl.appendChild(slice);

        const leg = document.createElement("div");
        leg.className = "legend-item";
        leg.innerHTML = `
          <span class="legend-dot" style="background-color: ${color}"></span>
          <span><strong>${subj}:</strong> ${slicePct}% (${count})</span>
        `;
        legendEl.appendChild(leg);
      });
    }
  }

  const tbody = document.getElementById("report-table-body");
  if (tbody) {
    tbody.innerHTML = "";

    if (tasks.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No task records available.</td></tr>`;
      return;
    }

    tasks.forEach(t => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><span class="badge ${t.completed ? 'badge-safe' : 'badge-warning'}">${t.completed ? 'Completed' : 'Pending'}</span></td>
        <td><strong>${t.title}</strong></td>
        <td><span class="tag-subject" style="border-left: 3px solid ${SUBJECT_COLORS[t.subject] || '#3b82f6'}">${t.subject}</span></td>
        <td><span class="priority-badge priority-${t.priority.toLowerCase()}">${t.priority}</span></td>
        <td><button class="delete-btn" onclick="deleteTask(${t.id})" title="Delete">&times;</button></td>
      `;
      tbody.appendChild(tr);
    });
  }
}

// ================= DEMO DATA & EXPORTS =================
function populateDemoData() {
  tasks = [
    { id: 1, title: "Review Newton's Laws & Friction diagrams", subject: "Physics", priority: "High", completed: true },
    { id: 2, title: "Calculus: Definite Integrals Exercise 4.2", subject: "Maths", priority: "High", completed: true },
    { id: 3, title: "Organic Reactions: Carbonyl mechanisms", subject: "Chemistry", priority: "Medium", completed: true },
    { id: 4, title: "Binary Search Trees & Heap implementation", subject: "Computer Science", priority: "Low", completed: false },
    { id: 5, title: "Cellular Respiration cycle pathways", subject: "Biology", priority: "Medium", completed: false }
  ];
  totalMinutesStudied = 125;
  screenHours = 3.5;
  streakDays = 5;
  lastActiveDate = getIsoDate();

  activityHistory = {};
  const today = new Date();
  for (let i = 180; i >= 0; i--) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    const key = getIsoDate(d);
    if (i % 7 === 0) activityHistory[key] = 0;
    else if (i % 5 === 0) activityHistory[key] = 4;
    else if (i % 3 === 0) activityHistory[key] = 2;
    else activityHistory[key] = (i % 2) + 1;
  }
  activityHistory[getIsoDate()] = 4;

  localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
  localStorage.setItem(STORAGE_KEYS.MINUTES, totalMinutesStudied);
  localStorage.setItem(STORAGE_KEYS.SCREEN_HOURS, screenHours);
  localStorage.setItem(STORAGE_KEYS.STREAK, streakDays);
  localStorage.setItem(STORAGE_KEYS.LAST_ACTIVE, lastActiveDate);
  localStorage.setItem(STORAGE_KEYS.HEATMAP, JSON.stringify(activityHistory));

  if (screentimeInput) screentimeInput.value = screenHours;
  renderTasks();
  buildGitHubHeatmap();
  updateMetrics();
  renderReportView();
  if (streakCounterEl) streakCounterEl.textContent = `🔥 ${streakDays} Day Streak`;
}

function exportDailySummary() {
  const completed = tasks.filter(t => t.completed).length;
  const lines = [
    "============================================================",
    "          FOCUSPULSE COMPREHENSIVE REVISION AUDIT           ",
    `          Date: ${new Date().toLocaleDateString()}          `,
    "============================================================",
    "",
    `[METRICS]`,
    `- Current Habit Streak: ${streakDays} Day(s)`,
    `- Dedicated Study Time: ${totalMinutesStudied} Minutes`,
    `- Recreational Screen Time: ${screenHours} Hours`,
    `- Fatigue Diagnostic: ${riskStatEl ? riskStatEl.textContent : "N/A"}`,
    `- Tasks Completion Ratio: ${completed} / ${tasks.length} (${tasks.length > 0 ? Math.round((completed/tasks.length)*100) : 0}%)`,
    "",
    `[TASK REGISTRY]`,
    ...tasks.map(t => `  [${t.completed ? "DONE" : "PEND"}] [${t.subject.padEnd(16)}] (${t.priority.padEnd(6)}) ${t.title}`),
    "",
    "============================================================",
    "Report generated locally by FocusPulse Engine (Focus AI)"
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `FocusPulse_Report_${getIsoDate()}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function resetAllData() {
  if (confirm("Reset all stored sessions, tasks, and historical activity?")) {
    localStorage.clear();
    tasks = [];
    totalMinutesStudied = 0;
    screenHours = 0.0;
    streakDays = 0;
    lastActiveDate = null;
    activityHistory = {};
    if (screentimeInput) screentimeInput.value = 0.0;
    renderTasks();
    buildGitHubHeatmap();
    updateMetrics();
    renderReportView();
    if (streakCounterEl) streakCounterEl.textContent = `🔥 0 Day Streak`;
  }
}

// Window bindings
window.toggleTask = toggleTask;
window.deleteTask = deleteTask;