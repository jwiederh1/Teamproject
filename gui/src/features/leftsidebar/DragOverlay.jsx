import React from "react";
import { DragOverlay as DndDragOverlay } from "@dnd-kit/core";

/**
 * A custom wrapper around the `@dnd-kit/core` DragOverlay component.
 * This component provides a consistent portal for rendering the "ghost"
 * or "preview" of the item being dragged, ensuring it appears correctly
 * above all other elements on the page.
 *
 * @param {object} props - The component props.
 * @param {React.ReactNode} props.children - The child element to render inside the overlay while dragging.
 * @param {object} [props.style] - Additional styles to apply to the overlay wrapper.
 * @returns {JSX.Element} The rendered DragOverlay portal.
 */
function CustomDragOverlay({ children, ...props }) {
  return (
    <DndDragOverlay
      {...props}
      style={{
        position: "fixed",
        pointerEvents: "none",
        zIndex: 9999,
        width: "auto",
        height: "auto",
        ...props.style,
      }}
    >
      {children}
    </DndDragOverlay>
  );
}

export default CustomDragOverlay;
