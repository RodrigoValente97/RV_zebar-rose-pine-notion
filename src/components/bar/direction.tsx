import { cn, validateOptions } from "../../lib/utils";
import { createEffect, createSignal, Show } from "solid-js";
import { useProviders } from "../../lib/providers-context";
import * as zebar from "zebar";
import z from "zod";

export const DirectionSchema = z.object({
  colorTheme: z.enum([
    "text", "love", "gold", "rose", "pine", "foam", "iris",
    "moon-text", "moon-love", "moon-gold", "moon-rose", "moon-pine", "moon-foam", "moon-iris",
    "dawn-text", "dawn-love", "dawn-gold", "dawn-rose", "dawn-pine", "dawn-foam", "dawn-iris"
  ]).optional(),
});

function Direction(props: { options?: { [key: string]: any } } = {}) {
  const { glazewm } = useProviders();
  const [glazewmSig, setGlazewmSig] = createSignal<
    zebar.GlazeWmOutput | undefined
  >(undefined);

  const options = () => validateOptions(props.options ?? {}, DirectionSchema);
  const colorTheme = () => options().colorTheme ?? "love";

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
    return colorMap[theme] || colorMap["love"];
  };

  // Create a style object for the color theme
  const themeStyle = () => ({
    "--icon": getColorVariables(colorTheme())
  });

  return (
    <Show when={!!glazewm()?.tilingDirection}>
      <button
        class={cn(
          "h-8 w-8 flex items-center justify-center text-[var(--icon)] bg-[var(--icon)]/10 rounded-full p-1 transition-all duration-300",
          {
            "rotate-90": glazewm()?.tilingDirection === "vertical",
          }
        )}
        style={themeStyle()}
        onClick={() => glazewm()?.runCommand(`toggle-tiling-direction`)}
      >
        <i class="nf nf-md-flower_tulip text-lg"></i>
      </button>
    </Show>
  );
}

export default Direction;
