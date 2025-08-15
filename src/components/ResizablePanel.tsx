import React, { useState, useRef, useEffect } from 'react';

interface ResizablePanelProps {
  leftContent: React.ReactNode;
  rightContent: React.ReactNode;
  defaultLeftWidth?: number;
  minLeftWidth?: number;
  maxLeftWidth?: number;
}

const ResizablePanel: React.FC<ResizablePanelProps> = ({
  leftContent,
  rightContent,
  defaultLeftWidth = 25,
  minLeftWidth = 15,
  maxLeftWidth = 50,
}) => {
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
      
      if (newLeftWidth >= minLeftWidth && newLeftWidth <= maxLeftWidth) {
        setLeftWidth(newLeftWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, minLeftWidth, maxLeftWidth]);

  return (
    <div ref={containerRef} className="flex h-full w-full relative">
      <div 
        className="overflow-auto bg-gray-50 border-r border-gray-200"
        style={{ width: `${leftWidth}%` }}
      >
        {leftContent}
      </div>
      
      <div
        className={`absolute top-0 bottom-0 w-1 bg-gray-300 hover:bg-blue-500 cursor-col-resize z-10 ${
          isResizing ? 'bg-blue-500' : ''
        }`}
        style={{ left: `${leftWidth}%`, transform: 'translateX(-50%)' }}
        onMouseDown={() => setIsResizing(true)}
      >
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div className="flex flex-col gap-1">
            <div className="w-1 h-1 bg-gray-600 rounded-full"></div>
            <div className="w-1 h-1 bg-gray-600 rounded-full"></div>
            <div className="w-1 h-1 bg-gray-600 rounded-full"></div>
          </div>
        </div>
      </div>
      
      <div 
        className="flex-1 overflow-auto bg-white"
        style={{ width: `${100 - leftWidth}%` }}
      >
        {rightContent}
      </div>
    </div>
  );
};

export default ResizablePanel;