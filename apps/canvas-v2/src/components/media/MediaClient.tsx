"use client";
import { motion } from "framer-motion";
import { useState } from "react";
import { ChevronRight, Search, Calendar } from "lucide-react";
import HeroBanner from "@/components/Herobanner";
import { Lightbox } from "@/components/ui/lightbox";
import { imageGetUrl } from "@/utils/utils";

const galleryTeam =
  "https://images.pexels.com/photos/3861964/pexels-photo-3861964.jpeg?auto=compress&cs=tinysrgb&w=1600";

interface GalleryAlbum {
  id: string;
  title: string;
  date: string;
  category: string;
  coverImage: string | null;
  images: string[];
  description: string | null;
}

export default function MediaClient({ items }: { items: GalleryAlbum[] }) {
  const [activeCategory, setActiveCategory] = useState("all");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [activeAlbumImages, setActiveAlbumImages] = useState<
    { src: string; title: string; category: string; year: string }[]
  >([]);

  const categories = [
    { id: "all", label: "All" },
    ...Array.from(new Set(items.map((item) => item.category)))
      .filter(Boolean)
      .map((cat) => ({
        id: cat,
        label: cat,
      })),
  ];

  const filteredItems =
    activeCategory === "all"
      ? items
      : items.filter((item) => item.category === activeCategory);

  const openLightbox = (album: GalleryAlbum) => {
    if (album.images.length === 0) return;
    const images = album.images.map((img) => ({
      src: img,
      title: album.title,
      category: album.category,
      year: new Date(album.date).getFullYear().toString(),
    }));
    setActiveAlbumImages(images);
    setCurrentImageIndex(0);
    setLightboxOpen(true);
  };

  const closeLightbox = () => setLightboxOpen(false);

  const goToPrevious = () => {
    setCurrentImageIndex((prev) =>
      prev === 0 ? activeAlbumImages.length - 1 : prev - 1
    );
  };

  const goToNext = () => {
    setCurrentImageIndex((prev) =>
      prev === activeAlbumImages.length - 1 ? 0 : prev + 1
    );
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  return (
    <main>
      <HeroBanner
        backgroundImage={galleryTeam}
        badgeText="Our Moments"
        heading={
          <>
            Our <span className="text-gold">Gallery</span>
          </>
        }
        description="A visual journey through our milestones, events, and corporate activities."
      />

      <section className="py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center gap-4 mb-16">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`px-6 py-2 rounded-full text-sm font-bold tracking-wide transition-all ${
                  activeCategory === category.id
                    ? "bg-navy text-white shadow-lg"
                    : "bg-gray-100 text-navy/60 hover:bg-gray-200 hover:text-navy"
                }`}
              >
                {category.label}
              </button>
            ))}
          </div>

          {filteredItems.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
              <div className="bg-gray-50 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
                <Search className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-2xl font-bold text-navy mb-2">
                No Albums Found
              </h3>
              <p className="text-gray-500 max-w-md mx-auto">
                {activeCategory === "all"
                  ? "We haven't uploaded any albums yet. Check back soon!"
                  : `No albums found in the "${activeCategory}" category.`}
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredItems.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="group cursor-pointer"
                  onClick={() => openLightbox(item)}
                >
                  <div className="relative overflow-hidden rounded-xl aspect-[4/3] mb-4 shadow-sm group-hover:shadow-xl transition-all duration-300">
                    <img
                      src={imageGetUrl(item.coverImage || item.images[0] || "")}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-navy/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                        <ChevronRight className="w-6 h-6 text-navy ml-0.5" />
                      </div>
                    </div>
                    <div className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded-md font-medium">
                      {item.images.length} Photos
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-navy group-hover:text-gold transition-colors">
                      {item.title}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-gray-400 mt-1 uppercase tracking-wider font-medium">
                      <span>{item.category}</span>
                      <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(item.date)}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      <Lightbox
        images={activeAlbumImages.map((item) => ({
          ...item,
          src: imageGetUrl(item.src),
        }))}
        currentIndex={currentImageIndex}
        isOpen={lightboxOpen}
        onClose={closeLightbox}
        onPrevious={goToPrevious}
        onNext={goToNext}
      />
    </main>
  );
}
