"use client";

import { ListBlockDef } from "./list-block";
import { ListWithDetailsDef } from "./list-details";
import { ImageCarouselDef } from "./image-carousel";
import { CountdownDef } from "./custom-countdown";
import { CustomMarqueeDef } from "./custom-marquee";
import { CustomSliderDef } from "./custom-slider";
import { CustomCarouselDef } from "./custom-carousel";
import { CustomGalleryDef } from "./custom-gallery";
import { CustomAccordianDef } from "./custom-accordian";
import { CustomCategoryDef } from "./custom-category";
import { BoxesDef } from "./custom-box";
import { QuotesDef } from "./custom-quotes";
import { SequenceDef } from "./custom-sequence";
import { StepsDef } from "./custom-step";
import { VideoCardDef } from "./custom-video";
import { CustomHtmlDef } from "./custom-html";
import { CustomHtmlDef } from "../../custom-registry/CustomHtml";

// --- REGISTRY OBJECT ---

export const CUSTOM_BLOCKS = {
  // Content
  html: CustomHtmlDef,
  custom_html: CustomHtmlDef,
  list: ListBlockDef,
  detail_list: ListWithDetailsDef,

  // Dynamic / Media
  carousel: ImageCarouselDef,
  custom_slider: CustomCarouselDef,
  customSlider: CustomCarouselDef,
  countdown: CountdownDef,
  gallery: CustomGalleryDef,
  accordion: CustomAccordianDef,
  video: VideoCardDef,

  // Layout / Containers
  boxes: BoxesDef,
  quotes: QuotesDef,
  sequence: SequenceDef,
  steps: StepsDef,

  // Commerce / Categories
  category_carousel: CustomCategoryDef,
  categories: CustomCategoryDef,
  collections: CustomCategoryDef,

  // Hero / Marquee
  marquee: CustomMarqueeDef,
  marquee_slider: CustomMarqueeDef,
  hero_slider: CustomSliderDef,
  hero: CustomSliderDef,
};
