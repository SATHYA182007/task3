/**
 * TaskFlow — JavaScript Logic & State Management Architecture
 *
 * Demonstrates:
 * - Single source of truth central state
 * - Unidirectional data flow (User Event -> State Update -> LocalStorage -> Render -> DOM)
 * - Complete CRUD operations (Create, Read, Update, Delete) + Complete/Uncomplete
 * - Event Delegation on dynamic DOM containers
 * - Safe DOM element creation (preventing XSS)
 * - LocalStorage persistence with JSON validation & error handling
 * - Accessible focus management & ARIA live region status messaging
 */

(function () {
  'use strict';

  // --------------------------------------------------------------------------
  // 1. Constants & Storage Keys
  // --------------------------------------------------------------------------
  const STORAGE_KEY = 'taskflow.tasks';
  const THEME_KEY = 'taskflow.theme';

  // --------------------------------------------------------------------------
  // 2. Central Application State (Single Source of Truth)
  // --------------------------------------------------------------------------
  const state = {
    tasks: [],
    filter: 'all', // 'all' | 'active' | 'completed'
    searchQuery: '',
    editingTaskId: null,
    theme: 'light'
  };

  // --------------------------------------------------------------------------
  // 3. Cached DOM References
  // --------------------------------------------------------------------------
  let dom = {};

  /**
   * Initialize DOM element references once on load.
   */
  function cacheDom() {
    dom = {
      themeToggleBtn: document.getElementById('theme-toggle'),
      taskForm: document.getElementById('task-form'),
      taskInput: document.getElementById('task-input'),
      addTaskBtn: document.getElementById('add-task-btn'),
      taskSearchInput: document.getElementById('task-search'),
      clearSearchBtn: document.getElementById('clear-search-btn'),
      filterGroup: document.querySelector('.filter-group'),
      filterButtons: document.querySelectorAll('.btn-filter'),
      clearCompletedBtn: document.getElementById('clear-completed-btn'),
      taskList: document.getElementById('task-list'),
      emptyState: document.getElementById('empty-state'),
      activeFilterLabel: document.getElementById('active-filter-label'),
      statTotal: document.getElementById('stat-total'),
      statActive: document.getElementById('stat-active'),
      statCompleted: document.getElementById('stat-completed'),
      badgeAll: document.getElementById('badge-all'),
      badgeActive: document.getElementById('badge-active'),
      badgeCompleted: document.getElementById('badge-completed'),
      statusMessage: document.getElementById('status-message')
    };
  }

  // --------------------------------------------------------------------------
  // 4. Utility Functions
  // --------------------------------------------------------------------------

  /**
   * Generates a guaranteed unique string ID for tasks.
   * Uses crypto.randomUUID() when available, with a timestamp fallback.
   * @returns {string} Unique identifier
   */
  function generateUniqueId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'tf_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
  }

  /**
   * Formats a timestamp into a human-readable string.
   * @param {number} timestamp - Unix timestamp in ms
   * @returns {string} Formatted date string
   */
  function formatDate(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Announces messages to screen readers via the ARIA live status region.
   * @param {string} message - Text announcement
   */
  function announceStatus(message) {
    if (dom.statusMessage) {
      dom.statusMessage.textContent = '';
      // Small timeout ensures screen readers re-announce repetitive statuses
      setTimeout(() => {
        dom.statusMessage.textContent = message;
      }, 50);
    }
  }

  // --------------------------------------------------------------------------
  // 5. Local Storage Persistence Logic
  // --------------------------------------------------------------------------

  /**
   * Saves the current tasks state array to window.localStorage safely.
   */
  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
    } catch (error) {
      console.error('TaskFlow: Failed to save tasks to localStorage:', error);
      announceStatus('Warning: Unable to save changes to browser storage.');
    }
  }

  /**
   * Loads and validates tasks from window.localStorage.
   * Gracefully handles corrupt or missing JSON data.
   */
  function loadState() {
    // 1. Load Theme
    try {
      const savedTheme = localStorage.getItem(THEME_KEY);
      if (savedTheme === 'dark' || savedTheme === 'light') {
        state.theme = savedTheme;
      } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        state.theme = 'dark';
      }
    } catch (e) {
      state.theme = 'light';
    }
    applyTheme(state.theme);

    // 2. Load Tasks
    try {
      const rawData = localStorage.getItem(STORAGE_KEY);
      if (!rawData) {
        state.tasks = [];
        return;
      }
      const parsed = JSON.parse(rawData);
      if (Array.isArray(parsed)) {
        // Validate individual task items to guarantee schema integrity
        state.tasks = parsed.filter(item => 
          item &&
          typeof item.id === 'string' &&
          typeof item.title === 'string' &&
          typeof item.completed === 'boolean'
        ).map(item => ({
          id: item.id,
          title: item.title,
          completed: item.completed,
          createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
          updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : Date.now()
        }));
      } else {
        state.tasks = [];
      }
    } catch (error) {
      console.warn('TaskFlow: Invalid localStorage data detected. Resetting to empty state.', error);
      state.tasks = [];
      announceStatus('Notice: Saved tasks were corrupted and have been reset.');
    }
  }

  /**
   * Applies the theme attribute to the HTML root element.
   * @param {string} themeName - 'light' | 'dark'
   */
  function applyTheme(themeName) {
    document.documentElement.setAttribute('data-theme', themeName);
    if (dom.themeToggleBtn) {
      const isDark = themeName === 'dark';
      dom.themeToggleBtn.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
      dom.themeToggleBtn.setAttribute('title', isDark ? 'Switch to light theme' : 'Switch to dark theme');
    }
  }

  // --------------------------------------------------------------------------
  // 6. CRUD & State Operations
  // --------------------------------------------------------------------------

  /**
   * CREATE: Adds a new task to state.
   * @param {string} rawTitle - User input title string
   */
  function createTask(rawTitle) {
    const title = rawTitle.trim();
    if (!title) {
      announceStatus('Cannot add empty task.');
      return;
    }

    const newTask = {
      id: generateUniqueId(),
      title: title,
      completed: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // Add to top of list (Newest first)
    state.tasks.unshift(newTask);
    saveState();
    render();
    announceStatus(`Task added: "${title}"`);

    // Reset input and return focus
    if (dom.taskInput) {
      dom.taskInput.value = '';
      dom.taskInput.focus();
    }
  }

  /**
   * TOGGLE: Toggles completed status for a given task ID.
   * @param {string} id - Task ID
   */
  function toggleTask(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;

    task.completed = !task.completed;
    task.updatedAt = Date.now();

    saveState();
    render();
    announceStatus(task.completed ? `Task completed: "${task.title}"` : `Task marked active: "${task.title}"`);
  }

  /**
   * START EDIT: Sets a task into editing mode.
   * @param {string} id - Task ID
   */
  function startEditing(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;

    state.editingTaskId = id;
    render();

    // Focus the inline edit input
    const editInput = dom.taskList.querySelector(`[data-task-id="${id}"] .edit-input`);
    if (editInput) {
      editInput.focus();
      editInput.select();
    }
  }

  /**
   * SAVE EDIT: Updates the title of an existing task.
   * @param {string} id - Task ID
   * @param {string} newTitle - Updated title text
   */
  function saveEdit(id, newTitle) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) {
      cancelEdit();
      return;
    }

    const trimmedTitle = newTitle.trim();
    if (!trimmedTitle) {
      announceStatus('Task title cannot be empty.');
      return;
    }

    task.title = trimmedTitle;
    task.updatedAt = Date.now();
    state.editingTaskId = null;

    saveState();
    render();
    announceStatus(`Task updated to: "${trimmedTitle}"`);

    // Restore focus to edit button of that task
    setTimeout(() => {
      const editBtn = dom.taskList.querySelector(`[data-task-id="${id}"] [data-action="edit"]`);
      if (editBtn) editBtn.focus();
    }, 50);
  }

  /**
   * CANCEL EDIT: Exits edit mode without saving changes.
   */
  function cancelEdit() {
    const previousId = state.editingTaskId;
    state.editingTaskId = null;
    render();
    announceStatus('Task editing cancelled.');

    if (previousId) {
      setTimeout(() => {
        const editBtn = dom.taskList.querySelector(`[data-task-id="${previousId}"] [data-action="edit"]`);
        if (editBtn) editBtn.focus();
      }, 50);
    }
  }

  /**
   * DELETE: Removes a task from state by ID.
   * @param {string} id - Task ID
   */
  function deleteTask(id) {
    const task = state.tasks.find(t => t.id === id);
    const taskTitle = task ? task.title : 'Task';

    state.tasks = state.tasks.filter(t => t.id !== id);
    if (state.editingTaskId === id) {
      state.editingTaskId = null;
    }

    saveState();
    render();
    announceStatus(`Task deleted: "${taskTitle}"`);
  }

  /**
   * CLEAR COMPLETED: Deletes all completed tasks from state.
   */
  function clearCompleted() {
    const completedCount = state.tasks.filter(t => t.completed).length;
    if (completedCount === 0) return;

    state.tasks = state.tasks.filter(t => !t.completed);
    saveState();
    render();
    announceStatus(`Cleared ${completedCount} completed task${completedCount > 1 ? 's' : ''}.`);
  }

  /**
   * SET FILTER: Changes active task filter mode.
   * @param {string} filterName - 'all' | 'active' | 'completed'
   */
  function setFilter(filterName) {
    if (!['all', 'active', 'completed'].includes(filterName)) return;
    state.filter = filterName;
    render();
    announceStatus(`Filter changed to ${filterName} tasks.`);
  }

  /**
   * SET SEARCH: Updates the search keyword query.
   * @param {string} query - Keyword query string
   */
  function setSearch(query) {
    state.searchQuery = query.trim().toLowerCase();
    render();
  }

  /**
   * TOGGLE THEME: Switches light/dark theme.
   */
  function toggleTheme() {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    applyTheme(state.theme);
    try {
      localStorage.setItem(THEME_KEY, state.theme);
    } catch (e) {}
    announceStatus(`Theme changed to ${state.theme} mode.`);
  }

  // --------------------------------------------------------------------------
  // 7. Derived Data Helpers
  // --------------------------------------------------------------------------

  /**
   * Derives filtered and searched task list without mutating state.tasks.
   * @returns {Array} Filtered task items array
   */
  function getFilteredTasks() {
    return state.tasks.filter(task => {
      // 1. Filter condition
      if (state.filter === 'active' && task.completed) return false;
      if (state.filter === 'completed' && !task.completed) return false;

      // 2. Search query condition
      if (state.searchQuery) {
        return task.title.toLowerCase().includes(state.searchQuery);
      }

      return true;
    });
  }

  // --------------------------------------------------------------------------
  // 8. Safe DOM Element Creation (Dynamic Rendering)
  // --------------------------------------------------------------------------

  /**
   * Safely constructs a normal task list item <li> using DOM APIs.
   * @param {Object} task - Task object
   * @returns {HTMLLIElement} Rendered li node
   */
  function createNormalTaskNode(task) {
    const li = document.createElement('li');
    li.className = `task-item ${task.completed ? 'completed' : ''}`;
    li.setAttribute('data-task-id', task.id);

    // 1. Task Main Container
    const taskMain = document.createElement('div');
    taskMain.className = 'task-main';

    // Accessible Checkbox Wrapper
    const checkboxLabel = document.createElement('label');
    checkboxLabel.className = 'checkbox-container';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'task-checkbox';
    checkbox.checked = task.completed;
    checkbox.setAttribute('data-action', 'toggle');
    checkbox.setAttribute('data-task-id', task.id);
    checkbox.setAttribute('aria-label', `Mark "${task.title}" as ${task.completed ? 'active' : 'completed'}`);

    const checkboxIcon = document.createElement('div');
    checkboxIcon.className = 'checkbox-icon';
    checkboxIcon.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    `;

    checkboxLabel.appendChild(checkbox);
    checkboxLabel.appendChild(checkboxIcon);

    // Text Content Box
    const contentBox = document.createElement('div');
    contentBox.className = 'task-content';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'task-title';
    titleSpan.textContent = task.title; // Safe text insertion (XSS-safe!)

    const dateSpan = document.createElement('span');
    dateSpan.className = 'task-date';
    dateSpan.textContent = `Created ${formatDate(task.createdAt)}`;

    contentBox.appendChild(titleSpan);
    contentBox.appendChild(dateSpan);

    taskMain.appendChild(checkboxLabel);
    taskMain.appendChild(contentBox);

    // 2. Task Actions
    const actionsBox = document.createElement('div');
    actionsBox.className = 'task-actions';

    // Edit Button
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn-action-icon';
    editBtn.setAttribute('data-action', 'edit');
    editBtn.setAttribute('data-task-id', task.id);
    editBtn.setAttribute('aria-label', `Edit task "${task.title}"`);
    editBtn.setAttribute('title', 'Edit Task');
    editBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
      </svg>
    `;

    // Delete Button
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn-action-icon btn-delete';
    deleteBtn.setAttribute('data-action', 'delete');
    deleteBtn.setAttribute('data-task-id', task.id);
    deleteBtn.setAttribute('aria-label', `Delete task "${task.title}"`);
    deleteBtn.setAttribute('title', 'Delete Task');
    deleteBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      </svg>
    `;

    actionsBox.appendChild(editBtn);
    actionsBox.appendChild(deleteBtn);

    li.appendChild(taskMain);
    li.appendChild(actionsBox);

    return li;
  }

  /**
   * Safely constructs an inline editing task item <li> node.
   * @param {Object} task - Task object
   * @returns {HTMLLIElement} Editing state li node
   */
  function createEditTaskNode(task) {
    const li = document.createElement('li');
    li.className = 'task-item task-item-editing';
    li.setAttribute('data-task-id', task.id);

    const form = document.createElement('form');
    form.className = 'edit-form';
    form.setAttribute('data-task-id', task.id);

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'edit-input';
    input.value = task.title;
    input.setAttribute('maxlength', '120');
    input.setAttribute('aria-label', `Edit task title for "${task.title}"`);
    input.required = true;

    const actions = document.createElement('div');
    actions.className = 'edit-actions';

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'btn btn-primary btn-sm';
    saveBtn.setAttribute('data-action', 'save');
    saveBtn.setAttribute('data-task-id', task.id);
    saveBtn.textContent = 'Save';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-secondary btn-sm';
    cancelBtn.setAttribute('data-action', 'cancel');
    cancelBtn.setAttribute('data-task-id', task.id);
    cancelBtn.textContent = 'Cancel';

    actions.appendChild(saveBtn);
    actions.appendChild(cancelBtn);

    form.appendChild(input);
    form.appendChild(actions);

    li.appendChild(form);
    return li;
  }

  /**
   * Renders empty state card depending on filter and search context.
   */
  function renderEmptyState() {
    const visibleTasks = getFilteredTasks();
    if (visibleTasks.length > 0) {
      dom.emptyState.classList.add('hidden');
      dom.emptyState.replaceChildren();
      return;
    }

    dom.emptyState.classList.remove('hidden');
    dom.emptyState.replaceChildren();

    let iconSvg = '';
    let titleText = '';
    let descText = '';

    if (state.searchQuery) {
      titleText = 'No matching tasks found';
      descText = `No tasks match "${state.searchQuery}". Try clearing your search query.`;
      iconSvg = `
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
      `;
    } else if (state.filter === 'active') {
      titleText = 'No active tasks';
      descText = 'You have no pending active tasks. Great job!';
      iconSvg = `
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
      `;
    } else if (state.filter === 'completed') {
      titleText = 'No completed tasks yet';
      descText = 'Tasks you mark as completed will appear here.';
      iconSvg = `
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
      `;
    } else {
      titleText = "You're all caught up!";
      descText = 'No tasks in your workspace. Add a task above to get started.';
      iconSvg = `
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 20h9"></path>
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
        </svg>
      `;
    }

    const iconDiv = document.createElement('div');
    iconDiv.innerHTML = iconSvg;

    const titleEl = document.createElement('h3');
    titleEl.className = 'empty-title';
    titleEl.textContent = titleText;

    const descEl = document.createElement('p');
    descEl.className = 'empty-desc';
    descEl.textContent = descText;

    dom.emptyState.appendChild(iconDiv.firstElementChild || iconDiv);
    dom.emptyState.appendChild(titleEl);
    dom.emptyState.appendChild(descEl);
  }

  // --------------------------------------------------------------------------
  // 9. Central Render Function (DOM Update)
  // --------------------------------------------------------------------------

  /**
   * Central render routine that synchronizes all UI elements with state.
   */
  function render() {
    // 1. Calculate stats counts
    const totalCount = state.tasks.length;
    const activeCount = state.tasks.filter(t => !t.completed).length;
    const completedCount = state.tasks.filter(t => t.completed).length;

    // Update Statistics Display
    if (dom.statTotal) dom.statTotal.textContent = totalCount;
    if (dom.statActive) dom.statActive.textContent = activeCount;
    if (dom.statCompleted) dom.statCompleted.textContent = completedCount;

    if (dom.badgeAll) dom.badgeAll.textContent = totalCount;
    if (dom.badgeActive) dom.badgeActive.textContent = activeCount;
    if (dom.badgeCompleted) dom.badgeCompleted.textContent = completedCount;

    // Update Clear Completed button state
    if (dom.clearCompletedBtn) {
      dom.clearCompletedBtn.disabled = completedCount === 0;
    }

    // 2. Update Filter Buttons (aria-pressed state)
    dom.filterButtons.forEach(btn => {
      const filterType = btn.getAttribute('data-filter');
      const isSelected = filterType === state.filter;
      btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    });

    // Update Active Filter Indicator text
    if (dom.activeFilterLabel) {
      const filterMap = {
        all: 'All Tasks',
        active: 'Active Tasks',
        completed: 'Completed Tasks'
      };
      let label = `Showing: ${filterMap[state.filter] || 'All Tasks'}`;
      if (state.searchQuery) {
        label += ` (Search: "${state.searchQuery}")`;
      }
      dom.activeFilterLabel.textContent = label;
    }

    // Show/Hide Clear Search button
    if (dom.clearSearchBtn) {
      if (state.searchQuery) {
        dom.clearSearchBtn.classList.remove('hidden');
      } else {
        dom.clearSearchBtn.classList.add('hidden');
      }
    }

    // 3. Render Task List
    const visibleTasks = getFilteredTasks();
    dom.taskList.replaceChildren();

    visibleTasks.forEach(task => {
      let taskNode;
      if (task.id === state.editingTaskId) {
        taskNode = createEditTaskNode(task);
      } else {
        taskNode = createNormalTaskNode(task);
      }
      dom.taskList.appendChild(taskNode);
    });

    // 4. Render Empty State
    renderEmptyState();
  }

  // --------------------------------------------------------------------------
  // 10. Event Handlers & Event Delegation
  // --------------------------------------------------------------------------

  /**
   * Handles task creation form submit.
   * @param {Event} e - Submit event
   */
  function handleFormSubmit(e) {
    e.preventDefault();
    if (!dom.taskInput) return;
    createTask(dom.taskInput.value);
  }

  /**
   * DELEGATED EVENT LISTENER on #task-list container for click events.
   * Intercepts actions (toggle, edit, save, cancel, delete).
   * @param {Event} e - Click event
   */
  function handleTaskListClick(e) {
    const actionElement = e.target.closest('[data-action]');
    if (!actionElement) return;

    const action = actionElement.getAttribute('data-action');
    const taskId = actionElement.getAttribute('data-task-id');

    if (!taskId && action !== 'clear-completed') return;

    switch (action) {
      case 'toggle':
        toggleTask(taskId);
        break;
      case 'edit':
        startEditing(taskId);
        break;
      case 'save': {
        const itemNode = actionElement.closest('.task-item-editing');
        const input = itemNode ? itemNode.querySelector('.edit-input') : null;
        if (input) {
          saveEdit(taskId, input.value);
        }
        break;
      }
      case 'cancel':
        cancelEdit();
        break;
      case 'delete':
        deleteTask(taskId);
        break;
      default:
        break;
    }
  }

  /**
   * DELEGATED EVENT LISTENER on #task-list container for keydown events.
   * Handles Enter to Save and Escape to Cancel during inline editing.
   * @param {Event} e - Keydown event
   */
  function handleTaskListKeyDown(e) {
    const editInput = e.target.closest('.edit-input');
    if (!editInput) return;

    const form = editInput.closest('.edit-form');
    if (!form) return;

    const taskId = form.getAttribute('data-task-id');

    if (e.key === 'Enter') {
      e.preventDefault();
      saveEdit(taskId, editInput.value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  }

  /**
   * Handles delegated clicks on filter buttons container.
   * @param {Event} e - Click event
   */
  function handleFilterClick(e) {
    const filterBtn = e.target.closest('.btn-filter');
    if (!filterBtn) return;

    const filterName = filterBtn.getAttribute('data-filter');
    if (filterName) {
      setFilter(filterName);
    }
  }

  /**
   * Binds all event listeners using DOM Level 3 addEventListener.
   * No inline HTML handlers used.
   */
  function bindEvents() {
    // Theme toggle
    if (dom.themeToggleBtn) {
      dom.themeToggleBtn.addEventListener('click', toggleTheme);
    }

    // Task creation form
    if (dom.taskForm) {
      dom.taskForm.addEventListener('submit', handleFormSubmit);
    }

    // Delegated task list events (Click & Keydown)
    if (dom.taskList) {
      dom.taskList.addEventListener('click', handleTaskListClick);
      dom.taskList.addEventListener('keydown', handleTaskListKeyDown);
    }

    // Delegated filter buttons
    if (dom.filterGroup) {
      dom.filterGroup.addEventListener('click', handleFilterClick);
    }

    // Clear completed button
    if (dom.clearCompletedBtn) {
      dom.clearCompletedBtn.addEventListener('click', clearCompleted);
    }

    // Search Input Listener
    if (dom.taskSearchInput) {
      dom.taskSearchInput.addEventListener('input', (e) => {
        setSearch(e.target.value);
      });
    }

    // Clear Search button
    if (dom.clearSearchBtn) {
      dom.clearSearchBtn.addEventListener('click', () => {
        if (dom.taskSearchInput) {
          dom.taskSearchInput.value = '';
          dom.taskSearchInput.focus();
        }
        setSearch('');
      });
    }
  }

  // --------------------------------------------------------------------------
  // 11. Application Initialization
  // --------------------------------------------------------------------------

  /**
   * Initializes the TaskFlow application once the DOM is ready.
   */
  function init() {
    cacheDom();
    loadState();
    bindEvents();
    render();
    console.log('TaskFlow: State-driven task management app initialized.');
  }

  // Execute initialization when DOM is loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
