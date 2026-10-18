const $ = (id) => document.getElementById(id);

const STORAGE_KEY = "daywise-tasks-v1";

let tasks = [];

try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  if (Array.isArray(saved)) {
    tasks = saved.filter(task =>
      task &&
      typeof task.id === "string" &&
      typeof task.title === "string" &&
      Number.isFinite(task.minutes) &&
      ["high", "medium", "low"].includes(task.priority) &&
      typeof task.done === "boolean"
    );
  }
} catch {
  tasks = [];
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    // The planner still works for the current session.
  }
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function render() {
  const total = tasks.length;
  const completed = tasks.filter(task => task.done).length;
  const remainingMinutes = tasks
    .filter(task => !task.done)
    .reduce((sum, task) => sum + task.minutes, 0);

  $("totalCount").textContent = total;
  $("completedCount").textContent = completed;
  $("studyTime").textContent =
    Number.isInteger(remainingMinutes / 60)
      ? `${remainingMinutes / 60}h`
      : `${(remainingMinutes / 60).toFixed(1)}h`;

  const list = $("taskList");
  list.replaceChildren();

  $("emptyMessage").hidden = total > 0;

  const priorityRank = { high: 0, medium: 1, low: 2 };

  [...tasks]
    .sort((a, b) =>
      priorityRank[a.priority] - priorityRank[b.priority]
    )
    .forEach(task => {
      const item = document.createElement("div");
      item.className = `task-item${task.done ? " done" : ""}`;

      item.innerHTML = `
        <input
          class="task-check"
          type="checkbox"
          aria-label="Complete ${escapeHTML(task.title)}"
          ${task.done ? "checked" : ""}
        >
        <div class="task-info">
          <div class="task-name">${escapeHTML(task.title)}</div>
          <div class="task-meta">${task.minutes} minutes</div>
        </div>
        <span class="priority ${task.priority}">
          ${task.priority}
        </span>
        <button class="delete-btn" type="button"
          aria-label="Delete ${escapeHTML(task.title)}">×</button>
      `;

      item.querySelector(".task-check").addEventListener("change", event => {
        task.done = event.target.checked;
        saveTasks();
        render();
      });

      item.querySelector(".delete-btn").addEventListener("click", () => {
        tasks = tasks.filter(entry => entry.id !== task.id);
        saveTasks();
        render();
      });

      list.appendChild(item);
    });
}

function addTask(title, minutes = 30, priority = "medium") {
  title = title.trim();

  if (!title) return false;
  if (tasks.length >= 100) {
    alert("Please finish or remove some tasks before adding more.");
    return false;
  }

  tasks.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: title.slice(0, 120),
    minutes: Math.max(5, Math.min(600, Number(minutes) || 30)),
    priority: ["high", "medium", "low"].includes(priority)
      ? priority : "medium",
    done: false
  });

  saveTasks();
  render();
  return true;
}

function buildPlan() {
  const result = $("planResult");
  result.hidden = false;

  const remaining = tasks
    .filter(task => !task.done)
    .sort((a, b) => {
      const rank = { high: 0, medium: 1, low: 2 };
      return rank[a.priority] - rank[b.priority];
    });

  if (!remaining.length) {
    result.textContent = "You're all caught up! Add a task to plan your next step.";
    return result.textContent;
  }

  let elapsed = 0;

  const lines = remaining.map((task, index) => {
    const start = formatTime(elapsed);
    elapsed += task.minutes;
    const end = formatTime(elapsed);

    return `${index + 1}. ${start}–${end}: ${task.title} (${task.minutes} min)`;
  });

  const totalHours = Math.floor(elapsed / 60);
  const extraMinutes = elapsed % 60;

  const summary =
    `Your suggested plan\n\n${lines.join("\n")}\n\n` +
    `Total focused time: ${totalHours}h ${extraMinutes}m\n` +
    `Tip: Take a short break between longer study sessions.`;

  result.textContent = summary;
  return summary;
}

function formatTime(minutes) {
  const hour = Math.floor((9 * 60 + minutes) / 60) % 24;
  const min = (9 * 60 + minutes) % 60;

  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${String(min).padStart(2, "0")} ${suffix}`;
}

function addChatMessage(message, type) {
  const bubble = document.createElement("div");
  bubble.className = `chat-bubble ${type}`;
  bubble.textContent = message;
  $("chatMessages").appendChild(bubble);
  $("chatMessages").scrollTop = $("chatMessages").scrollHeight;
}

function getAssistantReply(message) {
  const text = message.toLowerCase();

  if (
    text.includes("plan") ||
    text.includes("schedule") ||
    text.includes("organize")
  ) {
    return buildPlan();
  }

  if (
    text.includes("time") ||
    text.includes("how long") ||
    text.includes("minutes")
  ) {
    const minutes = tasks
      .filter(task => !task.done)
      .reduce((sum, task) => sum + task.minutes, 0);

    return `You have ${minutes} minutes of unfinished tasks remaining. ` +
      `That's ${Math.floor(minutes / 60)} hours and ${minutes % 60} minutes.`;
  }

  if (
    text.includes("priority") ||
    text.includes("important") ||
    text.includes("first")
  ) {
    const next = tasks
      .filter(task => !task.done)
      .sort((a, b) => {
        const rank = { high: 0, medium: 1, low: 2 };
        return rank[a.priority] - rank[b.priority];
      })[0];

    return next
      ? `Consider starting with "${next.title}" (${next.priority} priority, ${next.minutes} minutes).`
      : "Add a task first, and I'll help you decide what to do next.";
  }

  if (text.includes("progress") || text.includes("completed")) {
    const done = tasks.filter(task => task.done).length;
    return `You've completed ${done} out of ${tasks.length} tasks. Keep going!`;
  }

  if (text.includes("help")) {
    return "Try asking me to plan your day, calculate remaining time, " +
      "identify your highest-priority task, or check your progress.";
  }

  return "I can help organize your current tasks. Try asking " +
    "'Plan my day', 'How much time do I need?', or 'What should I do first?'";
}

$("taskForm").addEventListener("submit", event => {
  event.preventDefault();

  const title = $("taskInput").value;
  const minutes = $("minutesInput").value;
  const priority = $("priorityInput").value;

  if (addTask(title, minutes, priority)) {
    $("taskInput").value = "";
    $("taskInput").focus();
  }
});

$("planBtn").addEventListener("click", () => {
  buildPlan();
});

$("chatForm").addEventListener("submit", event => {
  event.preventDefault();

  const input = $("chatInput");
  const message = input.value.trim();

  if (!message) return;

  addChatMessage(message, "user");
  input.value = "";

  const reply = getAssistantReply(message);
  addChatMessage(reply, "assistant");
});

render();