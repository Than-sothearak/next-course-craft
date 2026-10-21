

export type GenerationSourceFile = {
  name: string;
  contentType:
    | "application/pdf"
    | "application/vnd.ms-powerpoint"
    | "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  bytes: Buffer;
};

export type SourcePlanItem = {
  title: string;
  focus: string;
  startPage: number;
  endPage: number;
  sourceElementIds: string[];
  recommendedBlockTypes: string[];
  interactionOpportunities: string[];
};

export type SourceCoursePlan = {
  title: string;
  description: string;
  objectives: string[];
  sourceLanguage: string;
  targetLanguage: string;
  items: SourcePlanItem[];
};
