// Add this component to your project

import React from 'react';
import { DragOverlay as DndDragOverlay } from '@dnd-kit/core';

function CustomDragOverlay({ children, ...props }) {
    return (
        <DndDragOverlay
            {...props}
            style={{
                position: 'fixed',
                pointerEvents: 'none',
                zIndex: 9999,
                left: 0,
                top: 0,
                width: 'auto',
                height: 'auto',
                ...props.style,
            }}
        >
            {children}
        </DndDragOverlay>
    );
}

export default CustomDragOverlay;