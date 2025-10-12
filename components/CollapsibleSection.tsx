import React, { useState } from 'react';

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  actions?: React.ReactNode;
  description?: string;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ title, children, defaultOpen = true, actions, description }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const titleId = `collapsible-title-${title.replace(/\s+/g, '-')}`;
  const contentId = `collapsible-content-${title.replace(/\s+/g, '-')}`;

  return (
    <section 
        className="bg-slate-50 dark:bg-slate-800 rounded-xl shadow-sm"
        aria-labelledby={titleId}
    >
      <div className="p-4 sm:p-6">
        <div className="flex justify-between items-start">
          <div className="flex-1 mr-4">
            <h2 id={titleId} className="text-lg font-bold text-slate-900 dark:text-white">
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-3xl">
                {description}
              </p>
            )}
          </div>
          <div className="flex-shrink-0">
            <button
              className="flex-shrink-0"
              onClick={() => setIsOpen(!isOpen)}
              aria-expanded={isOpen}
              aria-controls={contentId}
            >
              <svg
                className={`w-6 h-6 transform transition-transform duration-300 text-slate-500 ${isOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>
        {/* Actions moved from here to inside the collapsible area */}
      </div>
      <div
        id={contentId}
        className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="overflow-hidden">
            <div className="px-4 sm:px-6 pb-4 sm:pb-6 pt-0">
              {/* Actions are now rendered here, so they collapse with the content */}
              {actions && <div className="mt-4 mb-4" onClick={(e) => e.stopPropagation()}>{actions}</div>}
              {children}
            </div>
        </div>
      </div>
    </section>
  );
};

export default CollapsibleSection;