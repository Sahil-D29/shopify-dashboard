'use client';

interface FlowElement {
  id: string;
  type: 'text-input' | 'textarea' | 'radio' | 'checkbox' | 'dropdown' | 'date-picker';
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
  validation?: { maxLength?: number; pattern?: string };
}

interface FlowScreen {
  id: string;
  title: string;
  description?: string;
  elements: FlowElement[];
  navigation: { type: 'next' | 'complete'; nextScreenId?: string };
}

interface FlowScreenPreviewProps {
  screen: FlowScreen;
  flowName: string;
}

export function FlowScreenPreview({ screen, flowName }: FlowScreenPreviewProps) {
  return (
    <div className="flex flex-col items-center">
      <p className="mb-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
        Live Preview
      </p>

      {/* Phone frame */}
      <div className="w-[280px] rounded-[2rem] border-4 border-gray-800 bg-gray-800 shadow-xl">
        {/* Notch */}
        <div className="mx-auto mt-2 h-5 w-24 rounded-full bg-gray-900" />

        {/* Screen content */}
        <div className="mx-1 mb-1 mt-2 overflow-hidden rounded-[1.5rem] bg-white">
          {/* WhatsApp-style header */}
          <div className="bg-[#075E54] px-4 py-3">
            <p className="text-[11px] font-medium text-white/80 truncate">
              {flowName || 'WhatsApp Flow'}
            </p>
            <p className="text-[13px] font-semibold text-white truncate">
              {screen.title || 'Untitled Screen'}
            </p>
          </div>

          {/* Body */}
          <div className="space-y-3 px-4 py-4" style={{ minHeight: '320px', maxHeight: '400px', overflowY: 'auto' }}>
            {/* Description */}
            {screen.description && (
              <p className="text-[12px] text-gray-600 leading-relaxed">
                {screen.description}
              </p>
            )}

            {/* Elements preview */}
            {screen.elements.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center mb-2">
                  <span className="text-gray-400 text-lg">+</span>
                </div>
                <p className="text-[11px] text-gray-400">No form elements</p>
                <p className="text-[10px] text-gray-300 mt-0.5">
                  Add elements in the editor
                </p>
              </div>
            )}

            {screen.elements.map((element) => (
              <div key={element.id} className="space-y-1">
                <label className="text-[11px] font-medium text-gray-700">
                  {element.label || 'Untitled'}
                  {element.required && <span className="text-red-500 ml-0.5">*</span>}
                </label>

                {element.type === 'text-input' && (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                    <span className="text-[11px] text-gray-400">
                      {element.placeholder || 'Type here...'}
                    </span>
                  </div>
                )}

                {element.type === 'textarea' && (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
                    <span className="text-[11px] text-gray-400">
                      {element.placeholder || 'Type your response...'}
                    </span>
                  </div>
                )}

                {element.type === 'radio' && (
                  <div className="space-y-1.5">
                    {(element.options || []).map((option, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="h-3.5 w-3.5 rounded-full border-2 border-gray-300 flex-shrink-0" />
                        <span className="text-[11px] text-gray-600">{option}</span>
                      </div>
                    ))}
                  </div>
                )}

                {element.type === 'checkbox' && (
                  <div className="space-y-1.5">
                    {(element.options || []).map((option, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="h-3.5 w-3.5 rounded border-2 border-gray-300 flex-shrink-0" />
                        <span className="text-[11px] text-gray-600">{option}</span>
                      </div>
                    ))}
                  </div>
                )}

                {element.type === 'dropdown' && (
                  <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                    <span className="text-[11px] text-gray-400">Select an option</span>
                    <svg className="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                )}

                {element.type === 'date-picker' && (
                  <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                    <span className="text-[11px] text-gray-400">Select a date</span>
                    <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* CTA Button */}
          <div className="border-t px-4 py-3">
            <button className="w-full rounded-lg bg-[#25D366] py-2.5 text-[13px] font-semibold text-white">
              {screen.navigation.type === 'complete' ? 'Submit' : 'Continue'}
            </button>
          </div>

          {/* Footer */}
          <div className="border-t bg-gray-50 px-4 py-2">
            <p className="text-center text-[9px] text-gray-400">
              Powered by DOREC.IN
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
