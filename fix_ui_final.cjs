const fs = require('fs');

// Fix App.tsx
if (fs.existsSync('App.tsx')) {
    let appContent = fs.readFileSync('App.tsx', 'utf8');

    // Clean up duplicated break-words
    appContent = appContent.replace(/break-words overflow-hidden \[overflow-wrap:anywhere\] break-words overflow-hidden \[overflow-wrap:anywhere\]/g, 'break-words overflow-hidden [overflow-wrap:anywhere]');

    // Ensure textarea is correctly placed (it already is, but let's make sure indentation is clean)
    // Actually, I'll just leave the textarea as is since it worked.

    fs.writeFileSync('App.tsx', appContent);
    console.log('App.tsx cleaned up.');
}

// Fix DoctorPortal.tsx
const doctorPath = 'components/doctor/DoctorPortal.tsx';
if (fs.existsSync(doctorPath)) {
    let docContent = fs.readFileSync(doctorPath, 'utf8');

    // Use a very flexible regex for the message bubble div
    docContent = docContent.replace(
        /max-w-\[85%\]\s+p-2\s+rounded-xl\s+text-xs(?!\s+break-words)/g,
        'max-w-[85%] p-2 rounded-xl text-xs break-words overflow-hidden [overflow-wrap:anywhere]'
    );

    fs.writeFileSync(doctorPath, docContent);
    console.log('DoctorPortal.tsx fixed.');
}
