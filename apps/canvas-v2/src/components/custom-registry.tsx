import { CustomComponentDef } from "../types";
import { BoxesDef } from "./custom-box";
import { QuotesDef } from "./custom-quotes";
import { SequenceDef } from "./custom-sequence";
import { StepsDef } from "./custom-step";
import { VideoCardDef } from "./custom-video";

// Imported from new sub-components
import { ListBlockDef } from "./custom-registry/ListBlock";
import { ListWithDetailsDef } from "./custom-registry/ListDetails";
import { ImageCarouselDef } from "./custom-registry/ImageCarousel";
import { CountdownDef } from "./custom-registry/Countdown";
import { CustomSliderDef } from "./custom-registry/CustomSlider";
import { CustomCarouselDef } from "./custom-registry/CusotmCarousel";
import { CustomMarqueeDef } from "./custom-registry/CustomMarquee";
import { CustomCategoryDef } from "./custom-registry/Custom-Category";
import { CustomGalleryDef } from "./custom-registry/Custom-Gallery";
import { CustomAccordianDef } from "./custom-registry/Custom-Accordian";
import { CustomHtmlDef } from "./custom-registry/CustomHtml";

export const CUSTOM_BLOCKS: Record<string, CustomComponentDef> = {
  html: CustomHtmlDef,
  custom_html: CustomHtmlDef,
  list: ListBlockDef,
  detail_list: ListWithDetailsDef,
  carousel: ImageCarouselDef,
  imageCarousel: ImageCarouselDef,
  product_carousel: ImageCarouselDef,
  productCarousel: ImageCarouselDef,
  countdown: CountdownDef,
  gallery: CustomGalleryDef,
  image_gallery: CustomGalleryDef,
  imageGallery: CustomGalleryDef,
  product_gallery: CustomGalleryDef,
  productGallery: CustomGalleryDef,
  accordion: CustomAccordianDef,
  video_cards: VideoCardDef,
  boxes: BoxesDef,
  quotes: QuotesDef,
  testimonials: QuotesDef,
  testimonial: QuotesDef,
  sequence: SequenceDef,
  step: StepsDef,
  steps: StepsDef,
  custom_slider: CustomCarouselDef,
  customSlider: CustomCarouselDef,
  hero_slider: CustomSliderDef,
  hero: CustomSliderDef,
  marquee: CustomMarqueeDef,
  marquee_slider: CustomMarqueeDef,
  category_carousel: CustomCategoryDef,
  categories: CustomCategoryDef,
  collections: CustomCategoryDef,
};
