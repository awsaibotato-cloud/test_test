
export async function getChatResponse(
  message: string, 
  history: { role: 'user' | 'model', parts: { text: string }[] }[], 
  personality: string = 'master',
  imageBase64?: string
) {
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history, personality, imageBase64 }),
    });

    if (!response.ok) throw new Error("Network response was not ok");
    const data = await response.json();
    return data.text;
  } catch (error) {
    console.error("Error fetching chat:", error);
    return "عذراً، واجهت مشكلة في الاتصال بالخادم. حاول مرة أخرى!";
  }
}
