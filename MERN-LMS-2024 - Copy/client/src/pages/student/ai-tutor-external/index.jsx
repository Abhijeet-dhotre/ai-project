import React from 'react';

// URL where your plan-wiz-20 app is running
// Change this if it's on a different port or deployed
const PLAN_WIZ_URL = import.meta.env.VITE_PLAN_WIZ_URL || 'http://localhost:8081';

const AiTutorExternalPage = () => {
  return (
    <div className="h-full w-full">
      <iframe
        src={PLAN_WIZ_URL}
        title="AI Tutor - Plan Wiz"
        // This calculates the height to fill the screen minus the header (assuming header is 80px)
        // Adjust 80px if your header height is different
        className="w-full h-[calc(100vh-80px)] border-0"
        frameBorder="0"
        allowFullScreen
        allow="microphone"
      />
    </div>
  );
};

export default AiTutorExternalPage;