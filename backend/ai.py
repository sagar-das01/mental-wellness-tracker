import os
from typing import Optional
from google import genai
from google.genai import types

SYSTEM_INSTRUCTION = """You are "CalmMind", a compassionate, professional mental wellness coach and therapist AI. 
Your goal is to analyze the user's daily check-in (mood rating, sleep hours, stress level, and journal notes) and provide supportive, actionable, and gentle wellness insights.

Output your response in clean, beautiful Markdown. Each insight must contain:
1. **⭐ Wellness Assessment & Validation** (Validate their current feeling with empathy and score their wellness state)
2. **💡 Gentle Coping Strategies** (Provide 3 practical, actionable tips based on their current sleep and stress level)
3. **🌱 Recommended Mindful Exercise** (Detail a simple 2-5 minute breathing, grounding, or physical stretching exercise tailored to their day)

Ensure the tone is warm, supportive, and non-judgmental. Keep it professional.
"""

def generate_wellness_insight(
    mood: int,
    sleep_hours: float,
    stress_level: int,
    notes: str,
    custom_api_key: Optional[str] = None
) -> str:
    api_key = custom_api_key or os.environ.get("GEMINI_API_KEY")
    
    if api_key:
        try:
            client = genai.Client(api_key=api_key)
            prompt = f"""
            User Check-In Data:
            - Mood Rating: {mood}/5 (1 is lowest, 5 is highest)
            - Sleep Hours: {sleep_hours} hours
            - Stress Level: {stress_level}/5 (1 is lowest, 5 is highest)
            - Journal Notes: "{notes}"
            """
            
            config = types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                temperature=0.7,
            )
            
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config=config
            )
            
            if response.text:
                return response.text
        except Exception as e:
            print(f"Error calling Gemini in wellness app: {e}. Falling back to mock insight.")
            
    # Mock fallback based on mood and stress levels
    if mood <= 2:
        return f"""**⭐ Wellness Assessment & Validation**
It sounds like you are going through a heavy or challenging day. It is completely okay not to feel okay. With a mood rating of **{mood}/5** and stress level at **{stress_level}/5**, your mind and body are working hard to process stress. Remember that rest is productive, and you are doing the best you can.

**💡 Gentle Coping Strategies**
1.  **Reduce Your Load:** Postpone non-essential tasks today. Give yourself permission to do less.
2.  **Savor a Warm Beverage:** Make a cup of herbal tea or warm water and focus entirely on the warmth of the mug in your hands for 5 minutes.
3.  **Create a Comfort Zone:** Dim the lights, put on comfortable clothes, and listen to a soft, relaxing playlist.

**🌱 Recommended Mindful Exercise: The 5-4-3-2-1 Grounding Method**
To ease your mind, look around you and silently name:
*   **5** things you can see (e.g., a chair, a pen).
*   **4** things you can feel (e.g., your feet on the floor).
*   **3** things you can hear (e.g., traffic, birds).
*   **2** things you can smell.
*   **1** thing you can taste.
This brings your awareness back to the safety of the present moment.
"""
    elif stress_level >= 4:
        return f"""**⭐ Wellness Assessment & Validation**
You are experiencing significant stress right now (**{stress_level}/5**). High stress combined with your sleep of **{sleep_hours} hours** can make tasks feel overwhelming. Your nervous system is in a heightened state of alert. Let's work on calming it down together.

**💡 Gentle Coping Strategies**
1.  **Acknowledge and Release:** Say to yourself, *"I feel stressed, but this feeling is temporary and will pass."*
2.  **Unclench and Release:** Check your shoulders, jaw, and brow right now. Drop your shoulders, unclench your teeth, and soften your eyes.
3.  **Limit Inputs:** Step away from news, emails, and social media feeds for the next 2 hours.

**🌱 Recommended Mindful Exercise: Box Breathing (4-4-4-4)**
1.  Inhale slowly through your nose for **4 seconds**.
2.  Hold your breath for **4 seconds**.
3.  Exhale slowly through your mouth for **4 seconds**.
4.  Wait at the bottom of the breath for **4 seconds**.
Repeat this cycle 4 times to regulate your heart rate and settle your nervous system.
"""
    else:
        return f"""**⭐ Wellness Assessment & Validation**
Your wellness check-in looks stable today! A mood of **{mood}/5** and stress level of **{stress_level}/5** indicate a balanced state. You slept **{sleep_hours} hours**, which is a solid foundation for physical and mental energy.

**💡 Gentle Coping Strategies**
1.  **Celebrate the Calm:** Notice the absence of high stress and take a moment to appreciate this balanced state.
2.  **Write Down One Win:** Jot down one thing that went well today, no matter how small.
3.  **Connect with Someone:** Send a quick, warm message to a friend or family member just to say hello.

**🌱 Recommended Mindful Exercise: Loving-Kindness Affirmation**
Close your eyes, take a deep breath, and silently repeat these words to yourself:
*   *May I be peaceful.*
*   *May I be healthy.*
*   *May I be kind to myself.*
*   *May I be happy.*
Let the positive words settle in as you exhale.
"""
