app_code = """
import streamlit as st
import json
import os
from PIL import Image

# --- CONFIGURATION ---
JSON_FILE = "master_quiz_data.json"
IMAGE_FOLDER = "extracted_images"

st.set_page_config(page_title="Medical PG Prep", layout="wide")

# --- CSS ---
st.markdown(\"\"\"
    <style>
    .correct { background-color: #d4edda; padding: 15px; border-radius: 5px; border: 1px solid #c3e6cb; color: #155724; margin-bottom: 10px;}
    .incorrect { background-color: #f8d7da; padding: 15px; border-radius: 5px; border: 1px solid #f5c6cb; color: #721c24; margin-bottom: 10px;}
    .explanation { background-color: #e2e3e5; padding: 15px; border-radius: 10px; margin-top: 10px; color: #383d41; }
    </style>
\"\"\", unsafe_allow_html=True)

@st.cache_data
def load_data():
    if not os.path.exists(JSON_FILE): return None
    with open(JSON_FILE, 'r') as f: return json.load(f)

def reset_quiz():
    st.session_state.current_index = 0
    st.session_state.score = 0
    st.session_state.show_explanation = False
    st.session_state.answer_submitted = False

data = load_data()

if not data:
    st.error("No data found. Please run the extraction script first.")
    st.stop()

# --- SIDEBAR ---
st.sidebar.title("🩺 MedQuiz Engine")

# 1. Select Subject
subjects = sorted(list(data.keys()))
selected_subject = st.sidebar.selectbox("1. Select Subject:", subjects, on_change=reset_quiz)

# 2. Select Chapter
chapters = data[selected_subject]
chapter_names = [ch['topic'] for ch in chapters]
selected_chapter_name = st.sidebar.selectbox("2. Select Chapter:", chapter_names, on_change=reset_quiz)

# Get Questions
current_chapter_data = next(ch for ch in chapters if ch['topic'] == selected_chapter_name)
questions = current_chapter_data['questions']
total = len(questions)

if "current_index" not in st.session_state: reset_quiz()

# --- MAIN UI ---
if total == 0:
    st.warning("This chapter has no questions.")
    st.stop()

# Progress
progress = (st.session_state.current_index + 1) / total
st.progress(progress)
st.caption(f"Question {st.session_state.current_index + 1} of {total} | Score: {st.session_state.score}")

q_data = questions[st.session_state.current_index]

# Question Text
st.markdown(f"### {q_data.get('text', 'No Text')}")

# Question Image
if q_data.get('image'):
    img_path = os.path.join(IMAGE_FOLDER, q_data['image'])
    if os.path.exists(img_path):
        st.image(img_path, use_column_width=False, width=500)

# Options
options = q_data.get('options', {})
formatted_opts = [f"{k}) {v}" for k, v in options.items()]
choice = st.radio("Choose Answer:", formatted_opts, index=None, disabled=st.session_state.answer_submitted)

col1, col2 = st.columns(2)

# Submit Logic
if col1.button("Submit", use_container_width=True, disabled=st.session_state.answer_submitted):
    if choice:
        st.session_state.answer_submitted = True
        st.session_state.show_explanation = True
        
        sel_key = choice.split(")")[0].strip().lower()
        corr_key = str(q_data.get('correct_option', '')).strip().lower()
        
        if sel_key == corr_key:
            st.session_state.score += 1
            st.markdown(f"<div class='correct'>✅ Correct! Answer: {corr_key.upper()}</div>", unsafe_allow_html=True)
        else:
            st.markdown(f"<div class='incorrect'>❌ Incorrect. Correct Answer: {corr_key.upper()}</div>", unsafe_allow_html=True)
    else:
        st.warning("Select an option.")

# Explanation
if st.session_state.show_explanation:
    st.markdown(f"<div class='explanation'><b>Explanation:</b><br>{q_data.get('explanation', 'No explanation')}</div>", unsafe_allow_html=True)
    if q_data.get('explanation_image'):
        exp_img = os.path.join(IMAGE_FOLDER, q_data['explanation_image'])
        if os.path.exists(exp_img):
            st.image(exp_img, caption="Explanation Reference")

# Next Button
if col2.button("Next ➡️", use_container_width=True, disabled=not st.session_state.answer_submitted):
    if st.session_state.current_index < total - 1:
        st.session_state.current_index += 1
        st.session_state.answer_submitted = False
        st.session_state.show_explanation = False
        st.rerun()
    else:
        st.success(f"Quiz Finished! Final Score: {st.session_state.score}/{total}")
        if st.button("Restart Chapter"):
            reset_quiz()
            st.rerun()
"""

with open("app.py", "w") as f:
    f.write(app_code)