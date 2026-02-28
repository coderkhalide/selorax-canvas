import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Search, ChevronDown, Check, Box, Loader2 } from "lucide-react";
import { useFunnel } from "../context/FunnelContext";
import { imageGetUrl } from "../utils/utils";
import { getProductTemplate, setCookie } from "../app/actions/product";

export const ProductSelector: React.FC = () => {
  const {
    products,
    selectedProduct,
    setSelectedProduct,
    setElements,
    setSelectedId,
    storeId,
    slug,
    setSlug,
    isProductLoading,
    setIsProductLoading,
  } = useFunnel();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  // const searchParams = useSearchParams(); // Removed dependency on searchParams

  // Memoize product list extraction to reuse across effects
  const productList = useMemo(() => {
    if (!products) return [];
    if (Array.isArray(products)) return products;
    if (Array.isArray(products.products)) return products.products;
    if (Array.isArray(products.data)) return products.data;
    return [];
  }, [products]);

  // Shared function to load product data (template)
  const loadProductData = useCallback(
    async (product: any) => {
      if (!storeId || !product.slug) return;

      // Start loading
      setIsProductLoading(true);

      // First set the basic product info
      setSelectedProduct(product);

      try {
        const res = await getProductTemplate(product.slug, storeId);

        // Update selected product with template status
        if (res.success) {
          const fullProduct = res.data?.product || product;
          setSelectedProduct({
            ...fullProduct,
            landing_template: res.template,
          });

          if (res.template) {
            let templateData = res.template;
            if (typeof templateData === "string") {
              try {
                templateData = JSON.parse(templateData);
              } catch (e) {
                console.error("Error parsing template JSON", e);
              }
            }

            if (Array.isArray(templateData)) {
              setElements(templateData);
            } else if (templateData && Array.isArray(templateData.elements)) {
              setElements(templateData.elements);
            }
          } else {
            // If no template found, clear elements to show empty state
            setElements([]);
            setSelectedId(null);
          }
        } else {
          // Handle error or empty state
          setElements([]);
          setSelectedId(null);
        }
      } catch (error) {
        console.error("Error fetching template", error);
      } finally {
        // Stop loading
        setIsProductLoading(false);
      }
    },
    [storeId, setElements, setSelectedId, setSelectedProduct, setIsProductLoading],
  );

  useEffect(() => {
    console.log("ProductSelector received products:", products);

    if (productList.length > 0) {
      setFilteredProducts(
        productList.filter(
          (product: any) =>
            product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            product.slug?.toLowerCase().includes(searchTerm.toLowerCase()),
        ),
      );
    } else {
      setFilteredProducts([]);
    }
  }, [productList, searchTerm, products]);

  // Auto-select product from URL slug
  useEffect(() => {
    // Only proceed if we have a slug and store_id
    if (slug && storeId) {
      if (selectedProduct?.slug !== slug) {
        console.log("Auto-selecting product from slug (Context):", slug);

        // Try to find in loaded products first
        const foundProduct = productList.find((p: any) => p.slug === slug);
        if (foundProduct) {
          loadProductData(foundProduct);
        } else {
          // Fallback: create minimal product and let loadProductData fetch full details
          loadProductData({ slug, name: slug });
        }
      }
    }
  }, [slug, storeId, productList, selectedProduct?.slug, loadProductData]);

  // Always render the component, but handle empty state in UI
  const hasProducts = productList.length > 0;

  const getMainImage = (product: any) => {
    if (product.images) {
      if (typeof product.images === "string") {
        return product.images.split(",")[0].trim();
      }
      if (Array.isArray(product.images) && product.images.length > 0) {
        return product.images[0];
      }
    }
    return product.image || product.thumbnail;
  };

  const handleProductSelect = async (product: any) => {
    setIsOpen(false);

    if (product.slug) {
      // Update Context slug
      setSlug(product.slug);
      // Update Cookie
      await setCookie("slug", product.slug);
      // Load product data directly (don't rely on effect)
      loadProductData(product);
    }
  };

  return (
    <div className="w-full mb-2">
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full flex items-center justify-between px-3 py-2 bg-white border border-gray-200 rounded-lg shadow-sm transition-all text-left ${!hasProducts || isProductLoading ? "opacity-75 cursor-not-allowed" : "hover:border-blue-500"}`}
          disabled={!hasProducts || isProductLoading}
        >
          {isProductLoading ? (
            <div className="flex items-center gap-2">
              <div className="relative w-5 h-5">
                <div className="absolute inset-0 rounded-full border-2 border-blue-200"></div>
                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-500 animate-spin"></div>
              </div>
              <span className="text-sm bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent font-medium">
                Loading
              </span>
              <span className="flex gap-0.5">
                <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-1 h-1 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-1 h-1 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </span>
            </div>
          ) : selectedProduct ? (
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-6 h-6 rounded bg-gray-100 flex-shrink-0 border border-gray-200 overflow-hidden">
                <img
                  src={imageGetUrl(getMainImage(selectedProduct))}
                  alt={selectedProduct.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
              <span className="text-sm font-medium text-gray-900 truncate">
                {selectedProduct.name}
              </span>
            </div>
          ) : (
            <span className="text-sm text-gray-500 flex items-center gap-2">
              Select Product
            </span>
          )}
          {isProductLoading ? null : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-2 border-b border-gray-100">
              <div className="relative flex items-center justify-center">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition-colors"
                  autoFocus
                />
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto py-1">
              {filteredProducts.length > 0 ? (
                filteredProducts.map((product: any) => (
                  <button
                    key={product.id}
                    onClick={() => handleProductSelect(product)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 transition-colors ${
                      selectedProduct?.id === product.id ? "bg-blue-50/50" : ""
                    }`}
                  >
                    <div className="w-8 h-8 rounded bg-white flex-shrink-0 border border-gray-200 overflow-hidden">
                      <img
                        src={imageGetUrl(getMainImage(product))}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {product.name}
                      </div>
                      {product.price && (
                        <div className="text-xs text-gray-500">
                          {product.currency_symbol || "$"}
                          {product.price}
                        </div>
                      )}
                    </div>
                  </button>
                ))
              ) : (
                <div className="px-4 py-8 text-center text-gray-500 text-sm">
                  No products found
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
