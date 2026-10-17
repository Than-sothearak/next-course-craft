export const slideTemplateIds = ["cover", "section", "title-description", "text-image", "image-text", "two-column", "three-cards", "full-image", "quote", "takeaways", "summary", "completion"] as const;
export type SlideTemplateId = typeof slideTemplateIds[number];
export type TemplateSlotDefinition = {
  key: string;
  label: string;
  type: "text" | "image" | "list" | "button";
  role?: "eyebrow" | "heading" | "body";
  sample?: string;
  maximum?: number;
  items?: Array<{ title: string; body: string }>;
};
export type SlideTemplateDefinition = {
  id: SlideTemplateId;
  version: 1;
  name: string;
  description: string;
  category: "Introduction" | "Content" | "Images" | "Closing";
  kind: "hero" | "section" | "text" | "split" | "columns" | "cards" | "fullImage" | "quote" | "list" | "completion";
  imageSide?: "left" | "right";
  slots: TemplateSlotDefinition[];
};
const eyebrow: TemplateSlotDefinition = { key: "eyebrow", label: "Section label", type: "text", role: "eyebrow", sample: "COURSECRAFT LEARNING", maximum: 100 };
const title = (sample: string): TemplateSlotDefinition => ({ key: "title", label: "Heading", type: "text", role: "heading", sample, maximum: 300 });
const body = (sample: string): TemplateSlotDefinition => ({ key: "body", label: "Description", type: "text", role: "body", sample, maximum: 3_000 });
const image: TemplateSlotDefinition = { key: "image", label: "Image", type: "image" };
const button: TemplateSlotDefinition = { key: "button", label: "Navigation button", type: "button", sample: "Let’s begin" };
const items = (label: string, values: Array<{ title: string; body: string }>): TemplateSlotDefinition => ({ key: "items", label, type: "list", items: values });
export const slideTemplateDefinitions: SlideTemplateDefinition[] = [
  { id: "cover", version: 1, name: "Title / Cover", category: "Introduction", kind: "hero", description: "A confident first impression with an editorial title and a clear next step.", slots: [eyebrow, title("A new way to\nsee what’s possible."), body("An engaging learning experience starts with a little curiosity. Introduce your course and invite learners to explore."), button] },
  { id: "section", version: 1, name: "Section Introduction", category: "Introduction", kind: "section", description: "Give your next chapter a moment to breathe.", slots: [{ ...eyebrow, sample: "CHAPTER 01" }, title("Start with the essentials."), body("Introduce the big idea for this section and explain why it matters.")] },
  { id: "title-description", version: 1, name: "Title + Description", category: "Content", kind: "text", description: "A beautifully typeset idea with room for an explanation.", slots: [eyebrow, title("Make the complex feel simple."), body("Use this space to explain one important concept. Keep your message focused, add a practical example, and connect it to something your learners already know.")] },
  { id: "text-image", version: 1, name: "Text + Image", category: "Images", kind: "split", imageSide: "right", description: "Tell the story on the left; bring it to life on the right.", slots: [eyebrow, title("An idea worth exploring."), body("Pair a clear explanation with an image that adds meaning. Replace this text with your lesson, and choose an image from your course media."), image] },
  { id: "image-text", version: 1, name: "Image + Text", category: "Images", kind: "split", imageSide: "left", description: "Lead with a visual, then connect it to your key message.", slots: [eyebrow, title("See the bigger picture."), body("A thoughtful image helps learners connect a new concept to the world around them. Add your own explanation here."), image] },
  { id: "two-column", version: 1, name: "Two-Column Content", category: "Content", kind: "columns", description: "Two related ideas, balanced and easy to compare.", slots: [eyebrow, title("Two ideas. One clear connection."), items("Columns", [{ title: "Understand the idea", body: "Introduce the first concept and explain its most useful detail." }, { title: "Put it into practice", body: "Connect the concept to an example your learners can use." }])] },
  { id: "three-cards", version: 1, name: "Three-Column Cards", category: "Content", kind: "cards", description: "A polished set of concepts, benefits, or learning objectives.", slots: [eyebrow, title("Small steps. Meaningful progress."), items("Cards", [{ title: "Explore", body: "Discover the ideas that will guide your learning." }, { title: "Practice", body: "Build confidence with relevant, practical examples." }, { title: "Apply", body: "Take your learning into the real world." }])] },
  { id: "full-image", version: 1, name: "Fullscreen Image", category: "Images", kind: "fullImage", description: "An immersive visual with readable text on a solid caption panel.", slots: [eyebrow, title("A different perspective."), body("Give this image a little context and invite your learners to look closer."), image] },
  { id: "quote", version: 1, name: "Quote / Highlight", category: "Content", kind: "quote", description: "Make one memorable thought the focus of the slide.", slots: [{ ...eyebrow, sample: "A MOMENT TO REFLECT" }, { ...title("Learning begins when we make room for curiosity."), label: "Quote" }, { ...body("Add the speaker’s name or your own reflection."), label: "Attribution / context" }] },
  { id: "takeaways", version: 1, name: "Key Takeaways", category: "Closing", kind: "list", description: "Turn your most important ideas into a clear, memorable list.", slots: [eyebrow, title("Take these ideas with you."), items("Takeaways", [{ title: "Focus on what matters", body: "Keep one clear goal at the center of your work." }, { title: "Make it practical", body: "Connect each idea to a real situation." }, { title: "Keep exploring", body: "Use what you have learned as a starting point." }])] },
  { id: "summary", version: 1, name: "Summary", category: "Closing", kind: "cards", description: "Bring the lesson together with a concise recap.", slots: [{ ...eyebrow, sample: "LET’S RECAP" }, title("The ideas that make a difference."), items("Summary points", [{ title: "The big idea", body: "Summarize the central concept from this lesson." }, { title: "The practical skill", body: "Remind learners what they can now do." }, { title: "The next step", body: "Suggest a useful way to put it into practice." }])] },
  { id: "completion", version: 1, name: "Thank You / Completion", category: "Closing", kind: "completion", description: "Celebrate the learning and leave a thoughtful final message.", slots: [{ ...eyebrow, sample: "WELL DONE" }, title("You’re ready for\nwhat comes next."), body("Thank you for taking this learning journey. Put your new ideas into practice, keep asking questions, and build on what you know."), { ...button, sample: "Continue" }] },
];
export function getSlideTemplate(id: SlideTemplateId) {
  return slideTemplateDefinitions.find((template) => template.id === id)!;
}
