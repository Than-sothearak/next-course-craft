import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Course } from "@/models/Course";
import { SlideCoverSurface } from "@/app/courses/[courseId]/_components/slide-presentation/slide-cover-surface";
import { SlideSurface } from "@/app/courses/[courseId]/_components/slide-presentation/slide-surface";
import { defaultSlideCover, defaultSlideCoverTypography, defaultSlideMaster, defaultSlideBodyTypography, slideCoverSchema, slideMasterSchema } from "@/lib/editor/slide-design";

describe("presentation typography", () => {
  it("validates and persists master header, footer, and body defaults", () => {
    const master = slideMasterSchema.parse({
      header: { fontFamily: "serif", fontSize: 44, fontWeight: "normal", fontStyle: "italic" },
      footer: { fontFamily: "rounded", fontSize: 18, fontWeight: "bold" },
      bodyTypography: { ...defaultSlideBodyTypography, fontFamily: "nokora", fontSize: 24, fontWeight: "bold" },
    });
    const course = new Course({ ownerId: "123456789012345678901234", title: "Typography", slideMaster: master });
    expect(course.validateSync()).toBeUndefined();
    expect(course.toObject().slideMaster).toMatchObject({ header: { fontSize: 44, fontStyle: "italic" }, footer: { fontSize: 18, fontFamily: "rounded" }, bodyTypography: { fontSize: 24, fontFamily: "nokora" } });
    const markup = renderToStaticMarkup(<SlideSurface master={master} title="Typography" number={1} total={1} />);
    expect(markup).toContain("--slide-body-size:24px");
    expect(markup).toContain("font-size:44px");
    expect(markup).toContain("font-style:italic");
    expect(markup).toContain("font-size:18px");
    expect(slideMasterSchema.safeParse({ bodyTypography: { ...defaultSlideBodyTypography, fontSize: 121 } }).success).toBe(false);
  });

  it("saves cover title, subtitle, label, and button styles and renders each one", () => {
    const cover = slideCoverSchema.parse({ ...defaultSlideCover,
      lessonOf: "Lesson", subtitle: "Welcome",
      titleStyle: { ...defaultSlideCoverTypography.title, fontSize: 72, color: "#ffcc00", textAlign: "left" },
      subtitleStyle: { ...defaultSlideCoverTypography.subtitle, fontSize: 28, fontStyle: "italic" },
      labelStyle: { ...defaultSlideCoverTypography.label, fontSize: 17 },
      buttonStyle: { ...defaultSlideCoverTypography.button, fontSize: 21, fontWeight: "normal" },
      buttonBackgroundColor: "#123456", buttonRadius: 20,
    });
    const markup = renderToStaticMarkup(<SlideCoverSurface cover={cover} title="Course title" master={defaultSlideMaster} onStart={() => {}} />);
    expect(markup).toMatch(/data-cover-element="title"[^>]*font-size:72px/);
    expect(markup).toMatch(/data-cover-element="subtitle"[^>]*font-size:28px/);
    expect(markup).toMatch(/data-cover-element="label"[^>]*font-size:17px/);
    expect(markup).toMatch(/data-cover-element="button"[^>]*font-size:21px/);
    expect(markup).toContain("background-color:#123456");
    expect(markup).toContain("border-radius:20px");
    expect(slideCoverSchema.safeParse({ ...cover, buttonRadius: 49 }).success).toBe(false);
  });
});
