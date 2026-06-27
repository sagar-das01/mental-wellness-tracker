import os
import json
import re
from datetime import datetime
from typing import Optional, List, Dict, Any

try:
    from google import genai
    from google.genai import types
except ImportError:  # pragma: no cover - optional dependency for local tests
    genai = None
    types = None

SYSTEM_INSTRUCTION = """You are "CalmMind", a compassionate, professional mental wellness coach and therapist AI. 
Your goal is to analyze the user's daily check-in (mood rating, sleep hours, stress level, and journal notes) and provide supportive, actionable, and gentle wellness insights.

Output your response in clean, beautiful Markdown. Each insight must contain:
1. **⭐ Wellness Assessment & Validation** (Validate their current feeling with empathy and score their wellness state)
2. **💡 Gentle Coping Strategies** (Provide 3 practical, actionable tips based on their current sleep and stress level)
3. **🌱 Recommended Mindful Exercise** (Detail a simple 2-5 minute breathing, grounding, or physical stretching exercise tailored to their day)

Ensure the tone is warm, supportive, and non-judgmental. Keep it professional.
"""

CHAT_SYSTEM_INSTRUCTION = """You are "CalmMind", an empathetic, supportive conversational companion trained in Cognitive Behavioral Therapy (CBT) and mindfulness principles. 
Your goal is to converse with the user, validate their feelings, offer gentle CBT reframing or coping skills, and help them navigate emotional stress.

Keep your responses conversational, warm, and relatively concise (1-3 short paragraphs). Do not give formal clinical diagnoses.
Use the user's recent daily wellness logs (mood, sleep, stress) provided in the system context to personalize your responses and follow up on how they are feeling (e.g., "I noticed you slept only 5 hours yesterday, how is your energy today?").
"""

REPORT_SYSTEM_INSTRUCTION = """You are "CalmMind", a professional mental wellness analyst and CBT coach. 
Analyze the user's weekly check-in logs and compile an empathetic, insightful, and structured Weekly Wellness Report.

Output in clean, print-friendly Markdown using these sections:
1. **📈 Weekly Trend Analysis**: Summarize mood, sleep, and stress averages and key correlations (e.g., "Mood dips on days with less than 6 hours of sleep").
2. **🌱 Empathy & Support**: Provide validation and gentle reflections on their journal logs.
3. **💡 CBT Action Plan**: Offer 3 actionable CBT goals or exercises for the upcoming week based on their patterns.
"""

CRISIS_RESPONSE = """### Immediate Support
I’m concerned that you may be in immediate distress.

Please contact emergency services now or reach out to a trusted adult, parent, teacher, or school counselor and stay with someone in person.

If you are in India, you can contact:
- iCALL: 9152987821
- Vandrevala Foundation: 9999666555

If you are elsewhere, call your local emergency number or crisis line now.
"""

TRIGGER_KEYWORDS = {
    "sleep_disruption": ["sleep", "insomnia", "restless", "tired", "exhausted"],
    "peer_comparison": ["compare", "comparison", "comparing", "friends", "everyone else", "behind"],
    "family_pressure": ["family", "parents", "mother", "father", "pressure at home"],
    "self_doubt": ["doubt", "worthless", "stupid", "failure", "cannot do"],
    "time_scarcity": ["time", "late", "deadline", "behind schedule", "no time"],
    "physical_symptoms": ["headache", "nausea", "chest", "panic", "shaking"],
    "syllabus_overload": ["syllabus", "too much", "coverage", "topics", "overwhelmed"],
}

CRISIS_KEYWORDS = ["kill myself", "suicide", "self harm", "hurt myself", "end it all", "can't go on"]


def analyze_journal(notes: str) -> Dict[str, Any]:
    text = (notes or "").lower()
    triggers = []
    for trigger, keywords in TRIGGER_KEYWORDS.items():
        if any(keyword in text for keyword in keywords):
            triggers.append(trigger)

    crisis = any(keyword in text for keyword in CRISIS_KEYWORDS)
    cleaned = re.sub(r"\s+", " ", notes or "").strip()
    return {"cleaned_text": cleaned, "triggers": triggers, "crisis": crisis}


def build_weekly_analysis(logs: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not logs:
        return {"trend": "No recent check-ins.", "common_triggers": []}

    avg_mood = sum(l["mood"] for l in logs) / len(logs)
    avg_sleep = sum(l["sleep_hours"] for l in logs) / len(logs)
    avg_stress = sum(l["stress_level"] for l in logs) / len(logs)

    trigger_counts: Dict[str, int] = {}
    for log in logs:
        for trigger in analyze_journal(log.get("notes", "")).get("triggers", []):
            trigger_counts[trigger] = trigger_counts.get(trigger, 0) + 1

    common_triggers = sorted(trigger_counts.items(), key=lambda item: (-item[1], item[0]))[:5]
    trend = (
        f"Average mood {avg_mood:.1f}/5, sleep {avg_sleep:.1f}h, stress {avg_stress:.1f}/5."
    )
    return {"trend": trend, "common_triggers": common_triggers}

def generate_wellness_insight(
    mood: int,
    sleep_hours: float,
    stress_level: int,
    notes: str,
    exam_type: Optional[str] = None,
    days_to_exam: Optional[int] = None,
    custom_api_key: Optional[str] = None
) -> str:
    analysis = analyze_journal(notes)
    if analysis["crisis"]:
        return CRISIS_RESPONSE

    api_key = custom_api_key or os.environ.get("GEMINI_API_KEY")
    
    if api_key and genai and types:
        try:
            client = genai.Client(api_key=api_key)
            prompt = f"""
            User Check-In Data:
            - Mood Rating: {mood}/5 (1 is lowest, 5 is highest)
            - Sleep Hours: {sleep_hours} hours
            - Stress Level: {stress_level}/5 (1 is lowest, 5 is highest)
            - Exam Type: {exam_type or "Not specified"}
            - Days to Exam: {days_to_exam if days_to_exam is not None else "Not specified"}
            - Detected Triggers: {", ".join(analysis["triggers"]) or "none"}
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

def generate_chat_response(
    messages: List[Dict[str, str]],
    logs: List[Dict[str, Any]],
    custom_api_key: Optional[str] = None
) -> str:
    for log in logs[:5]:
        if analyze_journal(log.get("notes", "")).get("crisis"):
            return CRISIS_RESPONSE

    api_key = custom_api_key or os.environ.get("GEMINI_API_KEY")
    
    # 1. Format logs context
    logs_context = "User's Recent Daily Wellness Data (latest first):\n"
    if logs:
        for idx, log in enumerate(logs[:5]):
            logs_context += f"- Log {idx+1} ({log['created_at'].split('T')[0]}): Mood={log['mood']}/5, Sleep={log['sleep_hours']}h, Stress={log['stress_level']}/5. Notes: \"{log['notes']}\"\n"
    else:
        logs_context += "No check-in logs submitted yet.\n"
        
    full_system_instruction = f"{CHAT_SYSTEM_INSTRUCTION}\n\n{logs_context}"
    
    if api_key and genai and types:
        try:
            client = genai.Client(api_key=api_key)
            
            # Convert messages history to Gemini SDK types
            gemini_contents = []
            for msg in messages:
                role = "user" if msg["role"] == "user" else "model"
                gemini_contents.append(types.Content(
                    role=role,
                    parts=[types.Part.from_text(text=msg["content"])]
                ))
            
            config = types.GenerateContentConfig(
                system_instruction=full_system_instruction,
                temperature=0.7,
            )
            
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=gemini_contents,
                config=config
            )
            
            if response.text:
                return response.text
        except Exception as e:
            print(f"Error calling Gemini in chat: {e}. Falling back to mock chat response.")
            
    # Mock Chat responses based on last message content
    last_user_message = messages[-1]["content"].lower() if messages else ""
    
    if "sleep" in last_user_message:
        return "I hear you. Sleep plays a massive role in regulating our emotions and stress levels. When we are sleep-deprived, our amygdala (the brain's emotional center) becomes significantly more reactive. Try to keep a consistent wind-down routine tonight. What helps you feel cozy before bed?"
    elif "stress" in last_user_message or "anxious" in last_user_message or "overwhelm" in last_user_message:
        return "It sounds like you're carrying a heavy load right now. Stress has a physical way of building up in our bodies—like a clenched jaw or tight shoulders. Let's take a slow, deep breath together. Remember, you don't have to figure everything out today. What is one small step we can release or postpone?"
    elif "sad" in last_user_message or "depressed" in last_user_message or "down" in last_user_message:
        return "Thank you for sharing that with me. It takes strength to acknowledge when we are feeling down. Please be extremely gentle with yourself today. You don't have to perform or 'fix' this feeling immediately. Let's focus on one tiny thing: maybe a stretch, a sip of water, or simply resting. I'm right here with you."
    else:
        return "I appreciate you opening up. As your wellness companion, I'm here to explore these thoughts with you using mindful techniques. What is currently occupying your mind the most right now, or what is one feeling you'd like to dive into?"

def generate_weekly_report(
    logs: List[Dict[str, Any]],
    custom_api_key: Optional[str] = None
) -> str:
    api_key = custom_api_key or os.environ.get("GEMINI_API_KEY")
    
    if not logs:
        return """## 📊 Weekly CalmMind Digest
*No check-ins yet*

### 📈 Weekly Trend Analysis
No check-in data found for the past week. Start with one short journal entry and the report will automatically summarize mood, sleep, and stress patterns.

### 🔎 Repeated Triggers
No trigger patterns available yet.

### 🌱 Empathy & Support
You do not need a full journal entry to get started. A single sentence about sleep, stress, or study pressure is enough to begin building your analysis history.

### 💡 CBT Action Plan for Next Week
1. Log one short check-in after study.
2. Include one stress trigger or exam worry.
3. Use the example prompts in the chat view to start quickly.
"""
        
    avg_mood = sum(l["mood"] for l in logs) / len(logs)
    avg_sleep = sum(l["sleep_hours"] for l in logs) / len(logs)
    avg_stress = sum(l["stress_level"] for l in logs) / len(logs)
    
    logs_summary = ""
    for idx, log in enumerate(logs):
        logs_summary += f"- Day {idx+1} ({log['created_at'].split('T')[0]}): Mood={log['mood']}/5, Sleep={log['sleep_hours']}h, Stress={log['stress_level']}/5. Notes: \"{log['notes']}\"\n"
    weekly = build_weekly_analysis(logs)
        
    if api_key and genai and types:
        try:
            client = genai.Client(api_key=api_key)
            prompt = f"""
            Generate a Weekly Wellness Report for the user.
            Averages:
            - Average Mood: {avg_mood:.1f}/5
            - Average Sleep: {avg_sleep:.1f} hours
            - Average Stress Level: {avg_stress:.1f}/5
            
            Logs list:
            {logs_summary}
            """
            
            config = types.GenerateContentConfig(
                system_instruction=REPORT_SYSTEM_INSTRUCTION,
                temperature=0.6,
            )
            
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config=config
            )
            
            if response.text:
                return response.text
        except Exception as e:
            print(f"Error generating weekly report: {e}. Falling back to mock report.")
            
    # Mock Report fallback based on averages
    sleep_comment = "good" if avg_sleep >= 7 else "low, which may be driving up your stress indicators."
    stress_comment = "moderate" if avg_stress <= 3 else "elevated. High stress impairs sleep recovery, creating a cycle."
    
    return f"""## 📊 Weekly CalmMind Digest
*Generated dynamically on {datetime.now().strftime('%Y-%m-%d')}*

### 📈 Weekly Trend Analysis
{weekly["trend"]}
*   **Average Mood:** **{avg_mood:.1f} / 5** (Balanced)
*   **Average Sleep:** **{avg_sleep:.1f} hours** (Sleep levels are {sleep_comment})
*   **Average Stress Level:** **{avg_stress:.1f} / 5** (Stress levels are {stress_comment})

### 🔎 Repeated Triggers
{json.dumps(weekly["common_triggers"])}

### 🌱 Empathy & Support
Looking back at your journal logs for the past week, you have shown incredible dedication to checking in on your well-being. Even on days when energy was low or notes were brief, stepping up to write down your state is a major act of self-care. Be proud of this step.

### 💡 CBT Action Plan for Next Week
1.  **Sleep Stabilization:** Attempt to anchor your wakeup time within the same 30-minute window daily to improve sleep depth.
2.  **Stress Buffer:** Dedicate 10 minutes at 6:00 PM to completely log off and do a brief body scan stretching routine.
3.  **Positive Anchors:** Write down one positive expectation at the start of each morning check-in to build focus.
"""
