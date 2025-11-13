import { createSignal, createMemo, onMount, onCleanup, For, Show } from "solid-js";
import { fetchTodos, toggleTodo, createTask, updateStepStatus, fetchStepOptions, togglePersonalStatus, NotionTodoItem } from "./bar/NotionTodo";

function loadNotionOptions(wm: "glazewm" | "komorebi" | "vanilla") {
  // Try to load Notion options from the saved layout
  try {
    const key = `zrp:layout:${wm}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      const layout = JSON.parse(saved);
      for (const column of layout.columns || []) {
        for (const component of column.components || []) {
          if (component.type === "notion" && component.options) {
            return component.options;
          }
        }
      }
    }
  } catch {}

  return {
    notionToken: "",
    databaseId: "",
    refreshInterval: 5 * 60 * 1000,
    useCorsProxy: true, // Enable CORS proxy by default
    corsProxyUrl: "https://corsproxy.io/?url=",
  };
}

export default function NotionWindow(props: {
  wm: "glazewm" | "komorebi" | "vanilla";
}) {
  const options = loadNotionOptions(props.wm);
  const [todos, setTodos] = createSignal<NotionTodoItem[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [stepOptions, setStepOptions] = createSignal<{id: string, name: string, color: string}[]>([]);
  
  // New task form state
  const [newTaskTitle, setNewTaskTitle] = createSignal("");
  const [isCreating, setIsCreating] = createSignal(false);
  
  // Filter state - hide personal tasks by default
  const [hidePersonal, setHidePersonal] = createSignal(true);

  const notionToken = options.notionToken || "";
  const databaseId = options.databaseId || "";
  const refreshInterval = options.refreshInterval || 5 * 60 * 1000;
  const useCorsProxy = options.useCorsProxy ?? true; // Default to true for CORS issues
  const corsProxyUrl = options.corsProxyUrl || "https://corsproxy.io/?url=";
  const colorTheme = options.colorTheme || "iris";

  // Function to get color variables based on theme
  const getColorVariables = (theme: string) => {
    const colorMap: Record<string, string> = {
      // Base colors
      text: "var(--rp-text)",
      love: "var(--rp-love)",
      gold: "var(--rp-gold)",
      rose: "var(--rp-rose)",
      pine: "var(--rp-pine)",
      foam: "var(--rp-foam)",
      iris: "var(--rp-iris)",
      // Moon variants
      "moon-text": "var(--rp-moon-text)",
      "moon-love": "var(--rp-moon-love)",
      "moon-gold": "var(--rp-moon-gold)",
      "moon-rose": "var(--rp-moon-rose)",
      "moon-pine": "var(--rp-moon-pine)",
      "moon-foam": "var(--rp-moon-foam)",
      "moon-iris": "var(--rp-moon-iris)",
      // Dawn variants
      "dawn-text": "var(--rp-dawn-text)",
      "dawn-love": "var(--rp-dawn-love)",
      "dawn-gold": "var(--rp-dawn-gold)",
      "dawn-rose": "var(--rp-dawn-rose)",
      "dawn-pine": "var(--rp-dawn-pine)",
      "dawn-foam": "var(--rp-dawn-foam)",
      "dawn-iris": "var(--rp-dawn-iris)"
    };
    return colorMap[theme] || colorMap["iris"];
  };

  // Create a style object for the color theme
  const themeStyle = {
    "--notion": getColorVariables(colorTheme)
  };

  const refresh = async () => {
    if (!notionToken || !databaseId) {
      setTodos([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Fetch both todos and step options
      const [newTodos, options] = await Promise.all([
        fetchTodos(notionToken, databaseId, useCorsProxy, corsProxyUrl),
        fetchStepOptions(notionToken, databaseId, useCorsProxy, corsProxyUrl)
      ]);
      
      setTodos(newTodos);
      setStepOptions(options);
      
      // Notify bar component that data was refreshed
      window.dispatchEvent(new CustomEvent('notion-todo-toggled'));
      console.log('📢 NotionWindow: Data refreshed and dispatched update event');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTodo = async (todo: NotionTodoItem) => {
    if (!notionToken) return;
    
    const success = await toggleTodo(todo, notionToken, useCorsProxy, corsProxyUrl);
    if (success) {
      refresh();
      // Notify other components (like the bar) that a todo was toggled
      window.dispatchEvent(new CustomEvent('notion-todo-toggled'));
      console.log('📢 NotionWindow: Dispatched todo toggle event');
    }
  };

  const handleUpdateStepStatus = async (todo: NotionTodoItem, newStepStatus: string) => {
    if (!notionToken) return;
    
    const success = await updateStepStatus(todo, newStepStatus, notionToken, useCorsProxy, corsProxyUrl);
    if (success) {
      refresh();
      // Notify other components that tasks were updated
      window.dispatchEvent(new CustomEvent('notion-todo-toggled'));
      console.log('📢 NotionWindow: Updated step status and dispatched update event');
    }
  };

  const handleTogglePersonal = async (todo: NotionTodoItem) => {
    if (!notionToken) return;
    
    const success = await togglePersonalStatus(todo, notionToken, useCorsProxy, corsProxyUrl);
    if (success) {
      refresh();
      // Notify other components that tasks were updated
      window.dispatchEvent(new CustomEvent('notion-todo-toggled'));
      console.log('📢 NotionWindow: Toggled personal status and dispatched update event');
    }
  };

  const handleCreateTask = async () => {
    const title = newTaskTitle().trim();
    
    console.log("🎯 handleCreateTask called with:", { title, notionToken: !!notionToken, databaseId: !!databaseId });
    
    if (!title || !notionToken || !databaseId) {
      console.log("❌ Missing required fields:", { title: !!title, notionToken: !!notionToken, databaseId: !!databaseId });
      return;
    }
    
    setIsCreating(true);
    try {
      console.log("🚀 Calling createTask...");
      const success = await createTask(title, "General", notionToken, databaseId, useCorsProxy, corsProxyUrl);
      console.log("📝 createTask result:", success);
      
      if (success) {
        setNewTaskTitle("");
        refresh();
        // Notify other components that tasks were updated
        window.dispatchEvent(new CustomEvent('notion-todo-toggled'));
        console.log('📢 NotionWindow: Created new task and dispatched update event');
      } else {
        console.error("❌ Task creation failed");
      }
    } catch (error) {
      console.error("💥 Exception in handleCreateTask:", error);
    } finally {
      setIsCreating(false);
    }
  };

  let intervalId: number | undefined;

  onMount(() => {
    refresh();
    intervalId = window.setInterval(refresh, Math.max(5_000, refreshInterval)); // Reduced from 15_000 to 5_000
  });

  onCleanup(() => {
    if (intervalId) window.clearInterval(intervalId);
  });

  // Filter to show only incomplete todos and sort by urgency
  const incompleteTodos = createMemo(() => {
    let filtered = todos().filter(todo => !todo.done);
    
    // Hide personal tasks if the filter is enabled
    if (hidePersonal()) {
      filtered = filtered.filter(todo => !todo.pessoal);
    }
    
    return filtered.sort((a, b) => {
      // If both have due dates, sort by date (earliest first)
      if (a.dueDateRaw && b.dueDateRaw) {
        return a.dueDateRaw.getTime() - b.dueDateRaw.getTime();
      }
      // If only one has a due date, prioritize it
      if (a.dueDateRaw && !b.dueDateRaw) return -1;
      if (!a.dueDateRaw && b.dueDateRaw) return 1;
      // If neither has a due date, sort alphabetically by title
      return a.title.localeCompare(b.title);
    });
  });

  return (
    <div 
      class="h-full w-full overflow-auto bg-neutral-900 p-4 text-neutral-200"
      style={themeStyle}
    >
      <div class="mx-auto max-w-4xl">
        <div class="mb-4 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <i class="ti ti-list text-2xl text-[var(--notion)]"></i>
            <h1 class="text-xl font-bold">Notion Todos</h1>
            <span class="text-sm text-neutral-400">
              ({incompleteTodos().length} pending)
            </span>
          </div>
          <div class="flex items-center gap-3">
            {/* Hide Personal Tasks Filter */}
            <label class="flex items-center gap-2 text-sm text-neutral-400 cursor-pointer">
              <input
                type="checkbox"
                class="rounded bg-neutral-800 border-neutral-600 text-[var(--notion)] focus:ring-[var(--notion)] focus:ring-1"
                checked={hidePersonal()}
                onChange={(e) => setHidePersonal(e.currentTarget.checked)}
              />
              Hide Personal
            </label>
            <button 
              class="rounded bg-neutral-800 px-3 py-1 text-sm hover:bg-neutral-700" 
              onClick={refresh}
            >
              Refresh
            </button>
          </div>
        </div>

        {/* New Task Form */}
        <Show when={notionToken && databaseId}>
          <div class="mb-4 rounded border border-neutral-800 bg-neutral-800/30 p-3">
            <div class="flex gap-2">
              <input
                type="text"
                class="flex-1 rounded bg-neutral-800 px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:ring-2 focus:ring-[var(--notion)]"
                placeholder="Add new task..."
                value={newTaskTitle()}
                onInput={(e) => setNewTaskTitle(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleCreateTask();
                  }
                }}
              />
              <button
                class="rounded bg-[var(--notion)] px-4 py-2 text-sm font-medium text-white hover:opacity-80 disabled:opacity-50"
                onClick={() => {
                  console.log("🖱️ Add button clicked!");
                  handleCreateTask();
                }}
                disabled={!newTaskTitle().trim() || isCreating()}
              >
                {isCreating() ? "Adding..." : "Add"}
              </button>
            </div>
          </div>
        </Show>

        <Show
          when={!loading() && notionToken && databaseId}
          fallback={
            <div class="rounded border border-neutral-800 bg-neutral-800/30 p-6 text-center">
              <i class="ti ti-list text-4xl text-neutral-500 mb-3"></i>
              <h2 class="text-lg font-medium text-neutral-300 mb-2">
                {loading() ? "Loading..." : "Notion not configured"}
              </h2>
              <p class="text-sm text-neutral-400">
                {loading() 
                  ? "Fetching todos from Notion..."
                  : "Add your Notion token and database ID via the config menu."
                }
              </p>
            </div>
          }
        >
          <Show
            when={incompleteTodos().length > 0}
            fallback={
              <div class="rounded border border-neutral-800 bg-neutral-800/30 p-6 text-center">
                <i class="ti ti-check text-4xl text-green-500 mb-3"></i>
                <h2 class="text-lg font-medium text-neutral-300 mb-2">
                  All tasks completed!
                </h2>
                <p class="text-sm text-neutral-400">
                  Great job! All your tasks are done.
                </p>
              </div>
            }
          >
            <div class="space-y-3">
              <For each={incompleteTodos()}>
                {(todo) => (
                  <div class="rounded border border-neutral-800 bg-neutral-800/30 p-4 hover:bg-neutral-800/50 transition-colors">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-3">
                        {/* Title */}
                        <span class="text-base font-medium text-neutral-200">
                          {todo.title}
                        </span>
                        {todo.url && (
                          <a 
                            href={todo.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            class="text-xs text-blue-400 hover:text-blue-300"
                          >
                            🔗 Link
                          </a>
                        )}
                      </div>
                      
                      <div class="flex items-center gap-3">
                        {/* Time */}
                        <span class="text-sm text-purple-300 min-w-[20px]">
                          {todo.timeStamp || 'X'}
                        </span>
                        
                        {/* Step Status with colors */}
                        <select
                          class="text-xs rounded px-2 py-1 border border-neutral-600 focus:outline-none focus:ring-1 focus:ring-[var(--notion)]"
                          style={{
                            "background-color": 
                              todo.stepStatus === 'To Start' ? 'var(--rp-pine)' :
                              todo.stepStatus === 'Started' ? 'var(--rp-gold)' :
                              todo.stepStatus === 'URGENT' ? 'var(--rp-love)' :
                              'rgb(64 64 64)',
                            color: 
                              todo.stepStatus === 'To Start' ? 'var(--rp-base)' :
                              todo.stepStatus === 'Started' ? 'var(--rp-base)' :
                              todo.stepStatus === 'URGENT' ? 'var(--rp-base)' :
                              'rgb(229 229 229)',
                            "border-color":
                              todo.stepStatus === 'To Start' ? 'var(--rp-pine)' :
                              todo.stepStatus === 'Started' ? 'var(--rp-gold)' :
                              todo.stepStatus === 'URGENT' ? 'var(--rp-love)' :
                              'rgb(82 82 82)'
                          }}
                          value={todo.stepStatus || ""}
                          onChange={(e) => {
                            const newStep = e.currentTarget.value;
                            if (newStep !== todo.stepStatus) {
                              handleUpdateStepStatus(todo, newStep);
                            }
                          }}
                        >
                          <For each={stepOptions()}>
                            {(option) => (
                              <option 
                                value={option.name}
                                style={{
                                  "background-color": 
                                    option.name === 'To Start' ? 'var(--rp-pine)' :
                                    option.name === 'Started' ? 'var(--rp-gold)' :
                                    option.name === 'URGENT' ? 'var(--rp-love)' :
                                    'rgb(64 64 64)',
                                  color: 
                                    option.name === 'To Start' ? 'var(--rp-base)' :
                                    option.name === 'Started' ? 'var(--rp-base)' :
                                    option.name === 'URGENT' ? 'var(--rp-base)' :
                                    'rgb(229 229 229)'
                                }}
                              >
                                {option.name}
                              </option>
                            )}
                          </For>
                        </select>
                        
                        {/* Personal Task Toggle - subtle rectangle */}
                        <button
                          class={`w-4 h-4 border rounded-sm transition-colors ${
                            todo.pessoal 
                              ? 'bg-blue-600 border-blue-500' 
                              : 'bg-transparent border-neutral-500 hover:border-neutral-400'
                          }`}
                          onClick={() => handleTogglePersonal(todo)}
                          title={todo.pessoal ? "Personal task (click to unmark)" : "Click to mark as personal"}
                        >
                          {todo.pessoal && (
                            <i class="ti ti-check text-[10px] text-white"></i>
                          )}
                        </button>
                        
                        {/* Done button with color */}
                        <button
                          class="text-xs text-white rounded px-3 py-1 transition-colors bg-green-600 hover:bg-green-500"
                          onClick={() => handleToggleTodo(todo)}
                        >
                          Done?
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </Show>
      </div>
    </div>
  );
}