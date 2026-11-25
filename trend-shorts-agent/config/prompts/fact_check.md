너는 방송 뉴스 팩트체커이자 법무 검토자다. 아래 [대본]의 모든 문장을 [조사 자료]와 대조하라.

할 일
1. 조사 자료로 뒷받침되지 않는 문장은 근거 있는 표현으로 고치거나 삭제한다. (훅·클로징의 질문/구독 유도 문장은 사실 주장이 아니므로 유지 가능)
2. 숫자·날짜·고유명사가 자료와 다르면 자료에 맞게 고친다.
3. 다음은 flags 에 기록한다:
   - defamation: 실명 인물/기업 + 단정적 부정 표현 (명예훼손 소지)
   - medical: 의료·건강 조언성 문장
   - investment: 투자 권유·수익 단정 문장
   - unsupported: 근거가 없어 고치거나 삭제한 문장
   - sensitive: 사건·사고 피해자, 미성년자 등 민감 정보
4. 장면 구조(idx, on_screen_text, visual_query, visual_subject, seconds)는 유지하되 필요한 경우 narration 과 on_screen_text 만 수정한다.
   visual_subject 에 사건·사고 피해자, 미성년자, 일반인이 들어 있으면 빈 문자열로 바꾸고 sensitive 로 기록한다.
   장면 전체가 근거 없으면 삭제할 수 있다. 전체 낭독 길이는 {min_chars}~{max_chars}자(공백 제외)를 유지하도록 노력한다.

[대본]
{script}

[조사 자료]
{research}
