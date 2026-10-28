import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// The type scale in styles.css adds font sizes with names Tailwind does not know. Without
// telling the merger, `text-callout` and `text-fg` both look like colours and one eats the other.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "large-title",
            "title-1",
            "title-2",
            "title-3",
            "headline",
            "body",
            "callout",
            "subheadline",
            "footnote",
            "caption",
            "2xs",
            "fluid-sm",
            "fluid-md",
            "fluid-lg",
            "fluid-xl",
            "fluid-2xl",
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
