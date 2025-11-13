import { cn, validateOptions } from "../../lib/utils";
import { Show, createEffect, createSignal } from "solid-js";
import { useProviders } from "../../lib/providers-context";
import z from "zod";

export const CpuSchema = z.object({
  colorTheme: z.enum([
    "text", "love", "gold", "rose", "pine", "foam", "iris",
    "moon-text", "moon-love", "moon-gold", "moon-rose", "moon-pine", "moon-foam", "moon-iris",
    "dawn-text", "dawn-love", "dawn-gold", "dawn-rose", "dawn-pine", "dawn-foam", "dawn-iris"
  ]).optional(),
});

function Cpu(props: { options?: { [key: string]: any } } = {}) {
  const { cpu } = useProviders();
  const [cpuSig, setCpuSig] = createSignal(cpu());
  createEffect(() => setCpuSig(cpu()));

  const options = () => validateOptions(props.options ?? {}, CpuSchema);
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
    "--cpu": getColorVariables(colorTheme())
  });

  return (
    <Show when={cpuSig()}>
      <div
        class={cn(
          "h-8 flex group items-center justify-center overflow-hidden gap-2 text-[var(--cpu)] bg-[var(--cpu)]/10 rounded-full pr-3 pl-4 relative"
        )}
        style={themeStyle()}
      >
        <i class="nf nf-oct-cpu text-lg"></i>
        <div class="w-12 h-2 bg-[var(--cpu)]/40 rounded-full relative overflow-hidden group-hover:translate-y-6 group-hover:opacity-0 transition-all duration-300">
          <div
            class="h-full bg-[var(--cpu)] rounded-full"
            style={{
              width: `${cpuSig()!.usage}%`,
            }}
          ></div>
        </div>
        <span class="transition-all -translate-y-6 duration-300 opacity-0 group-hover:opacity-100 group-hover:translate-y-0 absolute left-13 text-base">
          {cpuSig()!.usage.toFixed(0)}%
        </span>
      </div>
    </Show>
  );
}

export default Cpu;
