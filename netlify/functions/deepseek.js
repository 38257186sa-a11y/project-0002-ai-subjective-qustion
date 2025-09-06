import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config(); // loads .env during local dev (netlify dev)

export async function handler(event) {
  try {
    if (!process.env.DEEPSEEK_API_KEY) {
      return { statusCode: 500, body: JSON.stringify({ error: 'DEEPSEEK_API_KEY not set on server.' }) };
    }

    const { prompt } = JSON.parse(event.body || '{}');
    if (!prompt) return { statusCode: 400, body: JSON.stringify({ error: 'Missing prompt in request body.' }) };

    // Call DeepSeek (endpoint name may vary — adjust if needed)
    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const text = await response.text();
      return { statusCode: response.status, body: JSON.stringify({ error: text }) };
    }

    const data = await response.json();

    // Normalize response content — many LLM APIs place text here
    const content = (data.choices && data.choices[0] && (data.choices[0].message?.content || data.choices[0].text))
                  || data.output
                  || JSON.stringify(data);

    return {
      statusCode: 200,
      body: JSON.stringify({ output: content })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}
