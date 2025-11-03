const Course = require("../models/Course");

const handleAiTutorRequest = async (req, res) => {
  const { question, courseId, lectureId } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;
  
  // Using the 2.5 flash model as requested
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

  if (!question) {
    return res.status(400).json({ success: false, message: "Question is required." });
  }
  if (!courseId || !lectureId) {
     return res.status(400).json({ success: false, message: "Course context is missing. Please select a lecture." });
  }

  try {
    // 1. Find the course and lecture to provide context
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found." });
    }

    const lecture = course.curriculum.id(lectureId);
    if (!lecture) {
      return res.status(404).json({ success: false, message: "Lecture not found." });
    }

    // --- 2. CONSTRUCT THE UPGRADED PROMPT ---
    const lectureNotes = lecture.lectureContent
      ? `**Lecture Content/Notes**:
         ${lecture.lectureContent}`
      : "**Lecture Content/Notes**: No specific notes were provided for this lecture.";

    const studyMaterial = `
      **Course Title**: ${course.title}
      **Course Description**: ${course.description}
      **Current Lecture Title**: ${lecture.title}
      
      ---
      
      ${lectureNotes}
    `;
    // --- END OF PROMPT MODIFICATION ---

    const prompt = `
        Based SOLELY on the following study material, answer the question accurately in clean, well-structured Markdown.
        
        - If the question cannot be answered from the material, state: "I'm sorry, that information is not covered in the provided notes for this lecture."

        **Study Material/Source**:
        ${studyMaterial}

        **Question**: ${question}

        **Answer**:
    `;

    // 3. Build the payload for the Gemini API
    const payload = {
      contents: [{
        role: "user",
        parts: [{ text: prompt }]
      }],
    };

    // 4. Call the Google AI API
    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!apiResponse.ok) {
      const errorResult = await apiResponse.json();
      throw new Error(errorResult.error?.message || 'AI API request failed');
    }

    const result = await apiResponse.json();

    if (result.candidates && result.candidates.length > 0) {
      const generatedText = result.candidates[0].content.parts[0].text;
      res.status(200).json({ success: true, answer: generatedText });
    } else {
      throw new Error('No valid response from AI.');
    }

  } catch (err) {
    console.error('AI Tutor Error:', err);
    res.status(500).json({ success: false, message: 'An error occurred while processing your request.', error: err.message });
  }
};

module.exports = { handleAiTutorRequest };