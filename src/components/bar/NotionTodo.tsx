import { createSignal, createMemo, onMount, onCleanup, createEffect } from "solid-js";
import { cn, validateOptions } from "../../lib/utils";
import z from "zod";

export type NotionTodoItem = {
  id: string;
  title: string;
  done: boolean;
  // Additional properties from your database
  projects?: string;
  plannedDueDate?: string;
  dueDateRaw?: Date | null;
  tags?: string[];
  stepStatus?: string;
  url?: string;
  timeStamp?: string;
  pessoal?: boolean;
};

export type NotionOptions = {
  notionToken?: string;
  databaseId?: string;
  refreshInterval?: number;
  useCorsProxy?: boolean;
  corsProxyUrl?: string;
  colorTheme?: "text" | "love" | "gold" | "rose" | "pine" | "foam" | "iris" |
              "moon-text" | "moon-love" | "moon-gold" | "moon-rose" | "moon-pine" | "moon-foam" | "moon-iris" |
              "dawn-text" | "dawn-love" | "dawn-gold" | "dawn-rose" | "dawn-pine" | "dawn-foam" | "dawn-iris";
};

export const NotionSchema = z.object({
  notionToken: z.string().optional(),
  databaseId: z.string().optional(), 
  refreshInterval: z.number().optional(),
  useCorsProxy: z.boolean().optional(),
  corsProxyUrl: z.string().optional(),
  colorTheme: z.enum([
    "text", "love", "gold", "rose", "pine", "foam", "iris",
    "moon-text", "moon-love", "moon-gold", "moon-rose", "moon-pine", "moon-foam", "moon-iris",
    "dawn-text", "dawn-love", "dawn-gold", "dawn-rose", "dawn-pine", "dawn-foam", "dawn-iris"
  ]).optional(),
});

// LocalStorage keys for caching seen todos
const SEEN_STORAGE_KEY = "zrp:notion:seen";

function loadSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

function persistSeen(seen: Set<string>) {
  try {
    localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(Array.from(seen)));
  } catch {}
}

// Fetch todos from Notion
export async function fetchTodos(
  notionToken: string, 
  databaseId: string, 
  useCorsProxy: boolean = false, 
  corsProxyUrl: string = "https://corsproxy.io/?url="
): Promise<NotionTodoItem[]> {
  try {
    // DEBUG: Log fetch attempt
    console.log("🔄 Fetching todos from Notion...", { 
      databaseId: databaseId.substring(0, 8) + "...", 
      hasToken: !!notionToken, 
      useCorsProxy 
    });
    
    const apiUrl = `https://api.notion.com/v1/databases/${databaseId}/query`;
    const fetchUrl = useCorsProxy ? `${corsProxyUrl}${encodeURIComponent(apiUrl)}` : apiUrl;
    
    console.log("📡 Request URL:", useCorsProxy ? "CORS Proxy" : "Direct");
    
    // Sort by created_time in descending order to get newest tasks first
    const requestBody = {
      sorts: [
        {
          timestamp: "created_time",
          direction: "descending"
        }
      ],
      page_size: 100
    };
    
    const res = await fetch(fetchUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${notionToken}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      mode: "cors",
    });
    
    console.log("📥 Response status:", res.status, res.statusText);
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error("❌ API Error:", res.status, errorText);
      // Try to extract meaningful error message
      let errorMsg = `HTTP ${res.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMsg = errorJson.message || errorMsg;
      } catch {}
      throw new Error(errorMsg);
    }
    
    const data = await res.json();
    
    // DEBUG: Log API response details
    console.log("✅ API Response received");
    console.log("📊 Number of results:", data.results?.length || 0);
    
    if (data.results?.length > 0) {
      console.log("🔍 First result properties:", Object.keys(data.results[0].properties));
      
      // Check if Title and Done properties exist
      const firstResult = data.results[0];
      const hasTitle = !!firstResult.properties.Title;
      const hasDone = !!firstResult.properties.Done;
      console.log("📝 Has Title property:", hasTitle);
      console.log("✅ Has Done property:", hasDone);
    }
    
    const mappedResults = data.results.map((page: any) => {
      const props = page.properties;
      
      // Your database has exactly "Title" and "Done"
      let title = "Untitled";
      if (props.Title && props.Title.title && props.Title.title[0]) {
        title = props.Title.title[0].plain_text;
      }
      
      let done = false;
      if (props.Done && typeof props.Done.checkbox === 'boolean') {
        done = props.Done.checkbox;
      }
      
      // Extract additional properties
      let projects = "";
      // Handle Projects as a relation field
      if (props.Projects) {
        if (props.Projects.relation && props.Projects.relation.length > 0) {
          // For relations, we need to get the title from the related page
          // Since we can't easily fetch related page titles in this context,
          // we'll show the first relation ID for now
          projects = `Related (${props.Projects.relation.length} items)`;
        } else if (props.Projects.select && props.Projects.select.name) {
          projects = props.Projects.select.name;
        } else if (props.Projects.rich_text && props.Projects.rich_text[0]) {
          projects = props.Projects.rich_text[0].plain_text;
        } else if (props.Projects.title && props.Projects.title[0]) {
          projects = props.Projects.title[0].plain_text;
        }
      }
      
      let plannedDueDate = "";
      let dueDateRaw: Date | null = null;
      if (props["Planed Due Date"] && props["Planed Due Date"].date) {
        const dateStr = props["Planed Due Date"].date.start;
        if (dateStr) {
          dueDateRaw = new Date(dateStr);
          plannedDueDate = dueDateRaw.toLocaleDateString();
        }
      }
      
      let tags: string[] = [];
      if (props.Tags && props.Tags.multi_select) {
        tags = props.Tags.multi_select.map((tag: any) => tag.name);
      }
      
      let stepStatus = "";
      if (props["Step?"] && props["Step?"].select && props["Step?"].select.name) {
        stepStatus = props["Step?"].select.name;
      }
      
      let url = "";
      if (props.URL && props.URL.url) {
        url = props.URL.url;
      }
      
      let timeStamp = "";
      if (props["Time Stamp"] && props["Time Stamp"].formula && props["Time Stamp"].formula.string) {
        timeStamp = props["Time Stamp"].formula.string;
      }
      
      // Get Pessoal checkbox value
      let pessoal = false;
      if (props["Pessoal"] && props["Pessoal"].checkbox !== undefined) {
        pessoal = props["Pessoal"].checkbox;
      }
      
      return {
        id: page.id,
        title,
        done,
        projects,
        plannedDueDate,
        dueDateRaw,
        tags,
        stepStatus,
        url,
        timeStamp,
        pessoal,
      };
    });
    
    console.log(`🎯 Mapped ${mappedResults.length} todos successfully`);
    mappedResults.forEach((todo, i) => {
      console.log(`  ${i+1}. "${todo.title}" (${todo.done ? 'done' : 'pending'}) - Project: "${todo.projects}"`);
    });
    
    // Debug: Show the structure of the first result's Projects field
    if (data.results.length > 0 && data.results[0].properties.Projects) {
      console.log("🔍 Projects field structure:", JSON.stringify(data.results[0].properties.Projects, null, 2));
    }
    
    // Sort by urgency: tasks with due dates first (earliest first), then tasks without due dates
    const sortedResults = mappedResults.sort((a, b) => {
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
    
    return sortedResults;
  } catch (e) {
    console.error("💥 Failed to fetch Notion todos:", e);
    throw e; // Re-throw so the UI can catch and display it
  }
}

// Toggle todo done state
export async function toggleTodo(
  todo: NotionTodoItem, 
  notionToken: string, 
  useCorsProxy: boolean = false, 
  corsProxyUrl: string = "https://corsproxy.io/?url="
) {
  try {
    const apiUrl = `https://api.notion.com/v1/pages/${todo.id}`;
    const fetchUrl = useCorsProxy ? `${corsProxyUrl}${encodeURIComponent(apiUrl)}` : apiUrl;
    
    console.log("🔄 Toggling todo:", todo.title, "Done:", !todo.done);
    
    const response = await fetch(fetchUrl, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${notionToken}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          Done: { checkbox: !todo.done },
        },
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Toggle failed:", response.status, errorText);
      return false;
    }
    
    console.log("✅ Todo toggled successfully");
    return true;
  } catch (e) {
    console.error("💥 Failed to update todo:", e);
    return false;
  }
}

// Fetch database schema to get Step? field options
export async function fetchStepOptions(
  notionToken: string,
  databaseId: string,
  useCorsProxy: boolean = false,
  corsProxyUrl: string = "https://corsproxy.io/?url="
) {
  try {
    const apiUrl = `https://api.notion.com/v1/databases/${databaseId}`;
    const fetchUrl = useCorsProxy ? `${corsProxyUrl}${encodeURIComponent(apiUrl)}` : apiUrl;
    
    console.log("🔍 Fetching database schema for Step? options");
    
    const response = await fetch(fetchUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${notionToken}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
    });
    
    if (!response.ok) {
      console.error("❌ Failed to fetch database schema:", response.status);
      return [];
    }
    
    const data = await response.json();
    const stepProperty = data.properties["Step?"];
    
    if (stepProperty && stepProperty.type === "select" && stepProperty.select.options) {
      const options = stepProperty.select.options.map((option: any) => ({
        id: option.id,
        name: option.name,
        color: option.color
      }));
      console.log("✅ Found Step? options:", options);
      return options;
    }
    
    console.log("⚠️ No Step? select options found");
    return [];
  } catch (e) {
    console.error("💥 Failed to fetch Step? options:", e);
    return [];
  }
}

// Toggle personal status of a todo
export async function togglePersonalStatus(
  todo: NotionTodoItem,
  notionToken: string,
  useCorsProxy: boolean = false,
  corsProxyUrl: string = "https://corsproxy.io/?url="
) {
  try {
    const apiUrl = `https://api.notion.com/v1/pages/${todo.id}`;
    const fetchUrl = useCorsProxy ? `${corsProxyUrl}${encodeURIComponent(apiUrl)}` : apiUrl;
    
    const newPersonalStatus = !todo.pessoal;
    console.log("🔄 Toggling personal status for:", todo.title, "to:", newPersonalStatus);
    
    const payload = {
      properties: {
        "Pessoal": {
          checkbox: newPersonalStatus
        }
      }
    };
    
    const response = await fetch(fetchUrl, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${notionToken}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Toggle personal status failed:", response.status, response.statusText);
      console.error("❌ Error details:", errorText);
      return false;
    }
    
    console.log("✅ Personal status toggled successfully");
    return true;
  } catch (e) {
    console.error("💥 Failed to toggle personal status:", e);
    return false;
  }
}

// Update step status of a todo
export async function updateStepStatus(
  todo: NotionTodoItem,
  newStepStatus: string,
  notionToken: string,
  useCorsProxy: boolean = false,
  corsProxyUrl: string = "https://corsproxy.io/?url="
) {
  try {
    const apiUrl = `https://api.notion.com/v1/pages/${todo.id}`;
    const fetchUrl = useCorsProxy ? `${corsProxyUrl}${encodeURIComponent(apiUrl)}` : apiUrl;
    
    console.log("🔄 Updating step status for:", todo.title, "to:", newStepStatus);
    
    const payload = {
      properties: {
        "Step?": {
          select: { name: newStepStatus }
        }
      }
    };
    
    const response = await fetch(fetchUrl, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${notionToken}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Update step status failed:", response.status, response.statusText);
      console.error("❌ Error details:", errorText);
      return false;
    }
    
    console.log("✅ Step status updated successfully");
    return true;
  } catch (e) {
    console.error("💥 Failed to update step status:", e);
    return false;
  }
}

// Create new todo in Notion database
export async function createTask(
  title: string,
  project: string,
  notionToken: string,
  databaseId: string,
  useCorsProxy: boolean = false,
  corsProxyUrl: string = "https://corsproxy.io/?url=",
  dueDate: string | null = null
) {
  try {
    const apiUrl = `https://api.notion.com/v1/pages`;
    const fetchUrl = useCorsProxy ? `${corsProxyUrl}${encodeURIComponent(apiUrl)}` : apiUrl;
    
    console.log("➕ Creating new task:", title);
    console.log("🔧 Using CORS proxy:", useCorsProxy, "URL:", fetchUrl);
    console.log("📅 Due date:", dueDate);
    
    // Build properties object
    const properties: any = {
      Title: {
        title: [{ text: { content: title } }]
      },
      Done: { checkbox: false }
    };
    
    // Add due date if provided
    if (dueDate) {
      properties["Planned Due Date"] = {
        date: { start: dueDate }
      };
    }
    
    // Use the same property names as in your database (Title and Done)
    const payload = {
      parent: { database_id: databaseId },
      properties
      // Note: Skipping Projects for now since it's a relation field
      // Relations are more complex and require existing page IDs
    };

    console.log("📦 Payload:", JSON.stringify(payload, null, 2));
    
    const response = await fetch(fetchUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${notionToken}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Create task failed:", response.status, response.statusText);
      console.error("❌ Error details:", errorText);
      
      // Try to parse the error response
      try {
        const errorJson = JSON.parse(errorText);
        console.error("❌ Parsed error:", errorJson);
      } catch (e) {
        console.error("❌ Could not parse error response");
      }
      
      return false;
    }
    
    const result = await response.json();
    console.log("✅ Task created successfully:", result.id);
    return true;
  } catch (e) {
    console.error("💥 Failed to create task:", e);
    return false;
  }
}

export default function NotionTodo(props: { options?: { [key: string]: any } }) {
  const options = () => validateOptions(props.options ?? {}, NotionSchema);
  const [todos, setTodos] = createSignal<NotionTodoItem[]>([]);
  const [seen, setSeen] = createSignal<Set<string>>(loadSeen());

  const refreshInterval = () => options().refreshInterval ?? 5 * 60 * 1000;
  const notionToken = () => options().notionToken ?? "";
  const databaseId = () => options().databaseId ?? "";
  const useCorsProxy = () => options().useCorsProxy ?? true; // Default to true for CORS issues
  const corsProxyUrl = () => options().corsProxyUrl ?? "https://corsproxy.io/?url=";
  const colorTheme = () => options().colorTheme ?? "iris";

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
  const themeStyle = () => ({
    "--notion": getColorVariables(colorTheme())
  });

  async function refresh() {
    if (!notionToken() || !databaseId()) {
      setTodos([]);
      return;
    }

    const newTodos = await fetchTodos(notionToken(), databaseId(), useCorsProxy(), corsProxyUrl());
    setTodos(newTodos);
  }

  function markSeen(id: string) {
    const next = new Set(seen());
    next.add(id);
    setSeen(next);
    persistSeen(next);
  }

  function markAllSeen() {
    const next = new Set(seen());
    for (const t of todos()) next.add(t.id);
    setSeen(next);
    persistSeen(next);
  }

  const unseen = createMemo(() => todos().filter((t) => !seen().has(t.id)));
  const pending = createMemo(() => todos().filter((t) => !t.done));

  let intervalId: number | undefined;

  onMount(() => {
    refresh();
    intervalId = window.setInterval(refresh, Math.max(5_000, refreshInterval())); // Reduced from 15_000 to 5_000
    
    // Listen for todo toggle events to refresh immediately
    const handleTodoToggle = () => {
      console.log('🔄 NotionTodo bar: Received todo toggle event, refreshing immediately...');
      // Use setTimeout to ensure immediate refresh without conflicts
      setTimeout(() => refresh(), 100);
    };
    window.addEventListener('notion-todo-toggled', handleTodoToggle);
    
    // Cleanup event listener
    onCleanup(() => {
      window.removeEventListener('notion-todo-toggled', handleTodoToggle);
    });
  });

  onCleanup(() => {
    if (intervalId) window.clearInterval(intervalId);
  });

  createEffect(() => {
    notionToken();
    databaseId();
    refresh();
  });

  const displayCount = createMemo(() => pending().length); // Show pending count instead of unseen

  const openNotionWindow = () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("notion", "1");
      window.open(
        url.toString(),
        "_blank",
        "location=yes,height=500,width=600,scrollbars=yes,status=yes"
      );
      
      // Also refresh data when opening window to ensure sync
      setTimeout(() => refresh(), 100);
    } catch {}
  };

  return (
    <button
      class={cn(
        "h-8 w-8 rounded-full flex items-center justify-center select-none",
        "text-[var(--notion)] bg-[var(--notion)]/10 hover:bg-[var(--notion)]/20 transition-colors"
      )}
      style={themeStyle()}
      title="Notion Todos"
      onClick={openNotionWindow}
    >
      <span class="text-sm font-bold">📝</span>
    </button>
  );
}