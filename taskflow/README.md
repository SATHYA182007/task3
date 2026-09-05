# TaskFlow — Focus & Productivity Workspace

**Thiranex Web Development Internship — Task 3: JavaScript Logic & State Management**

TaskFlow is a client-side productivity dashboard designed for efficient task management. It is built strictly using **HTML5, CSS3, and Vanilla JavaScript**, with zero external frameworks or libraries.

---

## 🌟 Features

- **Full CRUD Capabilities**:
  - **Create**: Add new tasks with title validation (rejects empty or whitespace-only inputs).
  - **Read**: Dynamic rendering driven strictly by a single central application state.
  - **Update**: In-place inline task editing (with `Enter` to save, `Escape` to cancel) and completion toggling.
  - **Delete**: Individual task removal and bulk "Clear Completed" functionality.
- **Local Persistence**: Tasks and theme preferences automatically persist using `window.localStorage`.
- **Advanced Filtering & Search**:
  - Filters: **All**, **Active**, **Completed** with live counter badges.
  - Keyword Search: Real-time search filter across tasks without altering underlying state.
- **Event Delegation**: Single event listener attached to the task container for dynamic child elements (`toggle`, `edit`, `save`, `cancel`, `delete`).
- **Polished UI/UX**: Responsive dashboard with light/dark theme toggle, clean typography (Inter), custom accessible checkboxes, and dynamic empty states.
- **Full Accessibility**: Keyboard focus management, ARIA live region status messaging (`role="status"`, `aria-live="polite"`), `aria-pressed` filter state indicators, and screen-reader accessible controls.

---

## 🛠️ Technology Stack

- **Markup**: HTML5 (Semantic elements: `<header>`, `<main>`, `<section>`, `<form>`, `<label>`, `<input>`, `<button>`, `<ul>`, `<li>`, `<footer>`).
- **Styling**: CSS3 (Vanilla CSS with custom properties/variables, flexbox, grid, responsive design, light/dark themes).
- **Logic**: Vanilla JavaScript (ES6+ standard APIs: DOM Level 3, `crypto.randomUUID()`, `window.localStorage`, Event Delegation).
- **Libraries/Dependencies**: None (0 external dependencies).

---

## 🏗️ Project Structure

```
taskflow/
├── index.html              # Main HTML markup & semantic structure
├── assets/
│   ├── css/
│   │   └── style.css       # Complete CSS design system & custom properties
│   └── js/
│       └── app.js          # Core JS state, DOM rendering, CRUD & delegation logic
└── README.md               # Technical documentation
```

---

## 📐 Application Architecture

TaskFlow uses a unidirectional, state-driven architecture where the DOM is purely a visual projection of the JavaScript state.

```
                  USER INTERACTION
                         │
                         ▼
                   EVENT HANDLER
                         │
                         ▼
                    STATE UPDATE
                         │
            ┌────────────┴────────────┐
            ▼                         ▼
   LOCALSTORAGE SAVING          RENDER FUNCTION
   (window.localStorage)              │
                                      ▼
                                 DOM UPDATE
```

---

## 📊 State Structure

The application state is maintained as a central `state` object:

```javascript
const state = {
  tasks: [
    {
      id: "3b9a8f12-4c2e-41df-a5b6-8e9d0a1b2c3d",
      title: "Complete internship Task 3 submission",
      completed: false,
      createdAt: 1725550000000,
      updatedAt: 1725550000000
    }
  ],
  filter: "all",         // 'all' | 'active' | 'completed'
  searchQuery: "",       // Keyword search query string
  editingTaskId: null,   // Task ID currently in edit mode, or null
  theme: "light"         // 'light' | 'dark'
};
```

---

## ⚙️ Core Logic Explanations

### 1. CRUD Implementation
- **Create**: `createTask(title)` validates non-empty strings, generates a unique ID via `crypto.randomUUID()` (with timestamp fallback), prepends the object to `state.tasks`, triggers `saveState()`, and calls `render()`.
- **Read**: `loadState()` parses stored JSON from `localStorage.getItem("taskflow.tasks")`, validates schema integrity, and initialises state.
- **Update**: `saveEdit(id, newTitle)` modifies task properties in place, resets `editingTaskId`, saves state, and re-renders UI. `toggleTask(id)` flips the `completed` boolean.
- **Delete**: `deleteTask(id)` removes the item by ID. `clearCompleted()` purges all completed items from `state.tasks`.

### 2. LocalStorage Persistence
- Storage key: `taskflow.tasks` for tasks, `taskflow.theme` for light/dark theme preference.
- Safe serialization using `JSON.stringify()` and `JSON.parse()`.
- **Error Handling**: Wrapped in `try...catch` blocks. If corrupt or malformed JSON is found in `localStorage`, TaskFlow gracefully catches the error, resets to `state.tasks = []`, and displays a non-blocking notification to the user without breaking execution.

### 3. Event Delegation
- Instead of binding separate event listeners to every task element or action button, a **single event listener** is attached to `#task-list`:
  ```javascript
  dom.taskList.addEventListener('click', handleTaskListClick);
  ```
- Handlers inspect `event.target.closest('[data-action]')` to retrieve `dataset.action` (`'toggle'`, `'edit'`, `'save'`, `'cancel'`, `'delete'`) and `dataset.taskId`.
- This ensures high memory efficiency and seamless handling of dynamically created task nodes.

### 4. Filtering & Derived Data
- Filtering does **NOT** mutate the original `state.tasks` array.
- `getFilteredTasks()` computes a derived task list based on `state.filter` and `state.searchQuery`:
  ```javascript
  function getFilteredTasks() {
    return state.tasks.filter(task => {
      if (state.filter === 'active' && task.completed) return false;
      if (state.filter === 'completed' && !task.completed) return false;
      if (state.searchQuery) return task.title.toLowerCase().includes(state.searchQuery);
      return true;
    });
  }
  ```

---

## 🚀 How to Run

1. Clone or download the repository directory.
2. Open `taskflow/index.html` directly in any web browser (Chrome, Edge, Firefox, Safari).
3. Alternatively, serve using a static web server:
   ```bash
   npx serve taskflow/
   # or
   python3 -m http.server --directory taskflow 8080
   ```

---

## 🧪 How to Test

Perform the following manual validation steps to inspect application integrity:

1. **Task Creation**:
   - Enter a task title (e.g. `"Build TaskFlow app"`) and press `Enter` or click `"Add Task"`.
   - Try adding a task with leading/trailing spaces (verify space trimming).
   - Try submitting an empty input or spaces-only (verify rejection).
2. **Persistence**:
   - Reload the browser tab or close and reopen the browser.
   - Verify that all added tasks remain intact in their respective states.
3. **Task Editing**:
   - Click the edit icon on a task.
   - Edit text and press `Enter` or click `"Save"`. Verify the title updates and focus returns cleanly.
   - Edit text and press `Escape` or click `"Cancel"`. Verify original title is retained.
4. **Completion & Filtering**:
   - Check the checkbox on a task. Notice strikethrough styling and statistics counter updates.
   - Switch filter tabs (**All**, **Active**, **Completed**). Verify only relevant tasks are visible.
5. **Clear Completed**:
   - Click `"Clear Completed"`. Verify all completed tasks are removed from both state and `localStorage`.
6. **Accessibility**:
   - Navigate the entire app using keyboard `Tab` and `Shift+Tab`.
   - Inspect `#status-message` element in Dev Tools to observe screen-reader live announcements.

---

## 📌 Known Limitations

- **Browser Storage Limit**: `window.localStorage` is subject to standard browser quota limits (typically 5MB per domain).
- **Single Device**: Tasks are persisted locally per browser profile and do not sync across multiple devices.
