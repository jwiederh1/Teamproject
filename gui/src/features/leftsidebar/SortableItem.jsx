import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/**
 * Renders a single draggable item within a sortable list.
 * This component integrates with `@dnd-kit` to handle the necessary
 * attributes, listeners, and styles for drag-and-drop functionality.
 *
 * @param {object} props - The component props.
 * @param {string} props.id - A unique identifier for the sortable item. This should match the item's value in the list.
 * @param {number} props.index - The zero-based index of the item in the list, used for displaying the rank number.
 * @param {number} [props.previewRank] - An optional rank to display, used by the drag overlay for a smooth visual update.
 * @returns {JSX.Element} The rendered list item with drag handles and styles.
 */
function SortableItem({ id, index, previewRank }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    transition: null,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition: isDragging ? "none" : transition,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 999 : "auto",
    position: "relative",
  };

  const displayRank = previewRank !== undefined ? previewRank : index + 1;

  return (
      <li
          ref={setNodeRef}
          style={style}
          {...attributes}
          className="sortable-item"
          data-dragging={isDragging}
      >
        <span data-rank={displayRank}>{id}</span>

        <div
            {...listeners}
            className="drag-handle"
            onTouchStart={(e) => e.stopPropagation()}
            aria-label="Drag handle"
            title="Drag to reorder"
        >
          <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
          >
            <circle cx="9" cy="5" r="1" />
            <circle cx="9" cy="12" r="1" />
            <circle cx="9" cy="19" r="1" />
            <circle cx="15" cy="5" r="1" />
            <circle cx="15" cy="12" r="1" />
            <circle cx="15" cy="19" r="1" />
          </svg>
        </div>
      </li>
  );
}

export default SortableItem;