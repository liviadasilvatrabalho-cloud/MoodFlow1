const fs = require('fs');
let c = fs.readFileSync('App.tsx', 'utf8');

// Replacement for word-wrap in message bubbles (if not already done)
c = c.replace(
    /max-w-\[90%\] p-2 rounded-xl text-\[11px\]/,
    'max-w-[90%] p-2 rounded-xl text-[11px] break-words overflow-hidden [overflow-wrap:anywhere]'
);

// Replacement for input -> textarea
const replTextarea = `                                                     <textarea
                                                         className="w-full sm:flex-1 bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-2.5 text-sm text-white focus:border-primary focus:outline-none shadow-inner min-h-[44px] max-h-[150px] resize-none"
                                                         placeholder="Sua resposta para o doutor..."
                                                         value={patientReply}
                                                         onChange={ev => setPatientReply(ev.target.value)}
                                                         onKeyDown={(e) => {
                                                             if (e.key === 'Enter' && !e.shiftKey && window.innerWidth > 768) {
                                                                 e.preventDefault();
                                                                 handleSavePatientReply(entry.id);
                                                             }
                                                         }}
                                                         autoFocus
                                                     />`;

c = c.replace(/<input\s+className="w-full sm:flex-1 bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-2.5 text-sm text-white focus:border-primary focus:outline-none shadow-inner"\s+placeholder="Sua resposta para o doutor..."\s+value={patientReply}\s+onChange=\{ev => setPatientReply\(ev.target.value\)\}\s+autoFocus\s+\/>/, replTextarea);

fs.writeFileSync('App.tsx', c);
console.log('Successfully updated App.tsx');
