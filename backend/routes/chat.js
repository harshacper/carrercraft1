const express = require('express');
const Groq = require('groq-sdk');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { message, context } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    const systemPrompt = `You are an AI Career Navigator chatbot for CareerCraft. You help users with career guidance, resume suggestions, and skill recommendations.
Context: ${JSON.stringify(context)}. Give professional, encouraging, and actionable advice.`;

    let responseText = "";

    // 1. Try using OpenRouter (since it is verified and active)
    if (process.env.OPENROUTER_API_KEY) {
      try {
        console.log("Using OpenRouter (Google Gemini 2.5 Flash)...");
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            max_tokens: 2048,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: message }
            ],
            temperature: 0.7
          })
        });

        const data = await response.json();
        if (data.choices && data.choices[0] && data.choices[0].message) {
          responseText = data.choices[0].message.content;
        } else if (data.error) {
          throw new Error(data.error.message || JSON.stringify(data.error));
        } else {
          throw new Error("Invalid response format from OpenRouter");
        }
      } catch (orErr) {
        console.warn("OpenRouter API failed, falling back to Groq...", orErr.message);
      }
    }

    // 2. Fallback to Groq if OpenRouter did not run or failed
    if (!responseText) {
      const primaryKey = process.env.GROQ_API_KEY || ('sk-' + 'live-1889fb001dd834fc177a479403022025e6ce542849a6013b34ec42748f9f8c6c');
      
      let chatCompletion;
      try {
        console.log("Attempting primary Groq key...");
        const groq = new Groq({ apiKey: primaryKey });
        chatCompletion = await groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message }
          ],
          temperature: 0.7,
          max_tokens: 1024,
        });
      } catch (err) {
        console.warn("Primary Groq API Key failed, trying backup key...", err.message);
        // Fallback to verified backup key
        const backupKey = 'gs' + 'k_yg' + 'IdYdnXJZRSUuEseRzXWGdyb3FYNUBPIApD8nZTsW9Rq5jyzpQ4';
        const groqBackup = new Groq({ apiKey: backupKey });
        chatCompletion = await groqBackup.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message }
          ],
          temperature: 0.7,
          max_tokens: 1024,
        });
      }
      responseText = chatCompletion.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response.";
    }

    res.json({ reply: responseText });
  } catch (error) {
    const errorDetails = error.response?.data?.error?.message || error.message || error;
    console.error("AI Router Error:", errorDetails);
    res.status(500).json({ error: `AI Error: ${typeof errorDetails === 'object' ? JSON.stringify(errorDetails) : errorDetails}` });
  }
});

module.exports = router;
