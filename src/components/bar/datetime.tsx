import { cn, validateOptions } from "../../lib/utils";
import { createSignal, createEffect, onCleanup } from "solid-js";
import z from "zod";

export const DatetimeSchema = z.object({
  colorTheme: z.enum([
    "text", "love", "gold", "rose", "pine", "foam", "iris",
    "moon-text", "moon-love", "moon-gold", "moon-rose", "moon-pine", "moon-foam", "moon-iris",
    "dawn-text", "dawn-love", "dawn-gold", "dawn-rose", "dawn-pine", "dawn-foam", "dawn-iris"
  ]).optional(),
});

function Datetime(props: { noIcon?: boolean; options?: { [key: string]: any } } = {}) {
  const [now, setNow] = createSignal(new Date());

  const options = () => validateOptions(props.options ?? {}, DatetimeSchema);
  const colorTheme = () => options().colorTheme ?? "rose";

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
    return colorMap[theme] || colorMap["rose"];
  };

  // Create a style object for the color theme
  const themeStyle = () => ({
    "--datetime": getColorVariables(colorTheme())
  });

  createEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);
    onCleanup(() => clearInterval(interval));
  });

  // Format: ddd dd MMM hh:mm
  function formattedDateTime() {
    const date = now();
    const weekday = date.toLocaleDateString(undefined, { weekday: "short" });
    const day = date.toLocaleDateString(undefined, { day: "2-digit" });
    const month = date.toLocaleDateString(undefined, { month: "short" });
    const hour = date.toLocaleTimeString(undefined, {
      hour12: false,
      hour: "2-digit",
    });
    let minute = date.getMinutes();
    const minuteStr = minute < 10 ? `0${minute}` : `${minute}`;

    return `${weekday} ${day} ${month} ${hour}:${minuteStr}`;
  }

  return (
    <div
      class={cn(
        "h-8 flex items-center transition-all duration-300 justify-center overflow-hidden gap-2 text-[var(--datetime)] bg-[var(--datetime)]/10 rounded-full pr-3 pl-4 relative"
      )}
      style={themeStyle()}
    >
      {!props.noIcon && <i class="ti ti-clock text-lg"></i>}
      <div class="rounded-full text-base font-semibold">
        {formattedDateTime()}
      </div>
    </div>
  );
}

export default Datetime;
