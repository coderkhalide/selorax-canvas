# Next.js এ Landing Page Renderer ইন্টিগ্রেশন করার চূড়ান্ত গাইড

এই গাইডটি আপনাকে দেখাবে কিভাবে আপনার তৈরি করা JSON ডেটা থেকে অন্য একটি Next.js প্রোজেক্টে সম্পূর্ণ ল্যান্ডিং পেজটি রেন্ডার করবেন। এটি একটি **Production-Ready, এডিটর-মুক্ত** এবং **সম্পূর্ণ জাভাস্ক্রিপ্ট (JS/JSX)** ভিত্তিক সমাধান।

## ১. ফাইলগুলো কপি করুন (Direct Copy)

নিচের `landing-page-renderer` ফোল্ডারটি আপনার নতুন Next.js প্রোজেক্টের রুট ডিরেক্টরিতে কপি করুন। আপনার স্ট্রাকচারটি এমন হওয়া উচিত:

```text
your-nextjs-app/
├── landing-page-renderer/
│   ├── components/
│   │   ├── PublicRenderer.jsx
│   │   ├── custom-registry.jsx
│   │   ├── custom-box.jsx
│   │   ├── ... (অন্যান্য কাস্টম ফাইল)
│   │   ├── EditableText.jsx
│   │   └── styleUtils.js
│   ├── context/
│   │   └── FunnelContext.jsx
│   └── RENDERER_GUIDE.md
├── app/
│   └── page.js
└── ...
```

## ২. প্রয়োজনীয় লাইব্রেরি ইনস্টল করুন

এই রেন্ডারারটি কাজ করার জন্য `lucide-react` (আইকনের জন্য) প্রয়োজন। নিচের কমান্ডটি চালান:

```bash
npm install lucide-react
```

## ৩. ইন্টিগ্রেশন কোড (page.js)

আপনার প্রোজেক্টের মেইন পেজে (যেমন: `app/page.js`) কোডটি নিচের মতো সেটআপ করুন:

```javascript
"use client"; // ক্লায়েন্ট সাইড রেন্ডারিং আবশ্যক

import { FunnelProvider } from "../landing-page-renderer/context/FunnelContext";
import { PublicRenderer } from "../landing-page-renderer/components/PublicRenderer";
import projectData from "../data/exported-data.json"; // আপনার বিল্ডার থেকে পাওয়া JSON ডেটা

export default function RenderedLandingPage() {
  if (!projectData || !projectData.elements) return <div>Loading...</div>;

  return (
    <FunnelProvider initialData={projectData}>
      {/* 
          FunnelProvider অটোমেটিক থিম কালারগুলো (CSS Variables) ইনজেক্ট করবে 
          এবং ডিভাইস ভিউ (Mobile/Desktop) ডিটেক্ট করবে।
      */}
      <div className="min-h-screen bg-background">
        {projectData.elements.map((element) => (
          <PublicRenderer key={element.id} element={element} />
        ))}
      </div>
    </FunnelProvider>
  );
}
```

## ৪. কিভাবে এটি কাজ করে? (How it works)

এই রেন্ডারারটি অত্যন্ত শক্তিশালী এবং এটি কয়েকটি মূল নীতির ওপর ভিত্তি করে কাজ করে:

### **ক. স্বয়ংক্রিয় থিমিং (Automatic Theming):**

`FunnelProvider` আপনার JSON ডেটা থেকে থিম ইনফরমেশন নেয় এবং সেগুলোকে CSS Variables (যেমন: `--color-primary`, `--color-foreground-heading`) হিসেবে বডিতে সেট করে। ফলে আপনার ডিজাইনটি হুবহু বিল্ডারের মতো দেখায়।

### **খ. অটো-রেসপন্সিভ ডিজাইন (Responsive Support):**

`PublicRenderer` ব্রাউজারের উইডথ (Width) নিজে থেকেই মনিটর করে। যখন স্ক্রিন ছোট হয় (৭৬৮ পিক্সেলের নিচে), এটি অটোমেটিক এলিমেন্টগুলোর `mobileStyle` ব্যবহার শুরু করে। আপনাকে আলাদা করে মোবাইল ভিউ ম্যানেজ করতে হবে না।

### **গ. গ্রেডিয়েন্ট এবং আইকন সাপোর্ট:**

টেক্সট এবং আইকনের জন্য বিল্ডারে ব্যবহার করা লিনিয়ার বা রেডিয়াল গ্রেডিয়েন্টগুলো এখানে হুবহু রেন্ডার হবে। `styleUtils.js` ফাইলটি এই জটিল সিএসএস লজিকগুলো হ্যান্ডেল করে।

### **ঘ. এডিটর-ফ্রি পারফরম্যান্স:**

এই ভার্সনটিতে এডিটরের কোনো ড্র্যাগ-এন্ড-ড্রপ লাইব্রেরি বা হিস্ট্রি লজিক নেই। এটি শুধুমাত্র ডেটা রিড করে রেন্ডার করে, যা আপনার সাইটকে সুপার ফাস্ট রাখে।

## ৫. বিশেষ টিপস

- **Tailwind CSS**: নিশ্চিত করুন আপনার নতুন প্রোজেক্টে Tailwind CSS কনফিগার করা আছে, কারণ কাস্টম কম্পোনেন্টগুলো স্টাইলিংয়ের জন্য টেলউইন্ড ক্লাস ব্যবহার করে।
- **Font**: পেজটি সুন্দর দেখানোর জন্য আপনার প্রোজেক্টে "Inter" বা "Outfit" ফন্টটি যোগ করতে পারেন।

---

আপনার যদি আরও কোনো কাস্টম পরিবর্তন বা নতুন ফিচারের প্রয়োজন হয়, তবে নিঃসংকোচে জানান।
