import { getTitleStyle } from "@/components/ui/title-badge";

describe("getTitleStyle", () => {
  it("returns amber style for GM", () => {
    const style = getTitleStyle("GM");
    expect(style).toEqual({
      bg: "bg-amber-500/20",
      text: "text-amber-700 dark:text-amber-400",
    });
  });

  it("returns orange style for IM", () => {
    const style = getTitleStyle("IM");
    expect(style!.bg).toBe("bg-orange-500/20");
  });

  it("returns teal style for FM", () => {
    const style = getTitleStyle("FM");
    expect(style!.bg).toBe("bg-teal-500/20");
  });

  it("returns sky style for CM", () => {
    const style = getTitleStyle("CM");
    expect(style!.bg).toBe("bg-sky-500/20");
  });

  it("returns slate style for NM", () => {
    const style = getTitleStyle("NM");
    expect(style!.bg).toBe("bg-slate-500/20");
  });

  it("maps WGM to GM colors", () => {
    const style = getTitleStyle("WGM");
    expect(style!.bg).toBe("bg-amber-500/20");
  });

  it("maps WIM to IM colors", () => {
    const style = getTitleStyle("WIM");
    expect(style!.bg).toBe("bg-orange-500/20");
  });

  it("maps WFM to FM colors", () => {
    const style = getTitleStyle("WFM");
    expect(style!.bg).toBe("bg-teal-500/20");
  });

  it("maps WCM to CM colors", () => {
    const style = getTitleStyle("WCM");
    expect(style!.bg).toBe("bg-sky-500/20");
  });

  it("returns null for empty/null title", () => {
    expect(getTitleStyle(null)).toBeNull();
    expect(getTitleStyle("")).toBeNull();
  });

  it("returns slate style for unknown titles", () => {
    const style = getTitleStyle("AGM");
    expect(style!.bg).toBe("bg-slate-500/20");
  });
});
