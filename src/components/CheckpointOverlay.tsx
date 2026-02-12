"use client";

import { useState } from "react";

interface CheckpointQuestion {
  type: string;
  questionText: string;
  options: { id: string; text: string }[];
  correctOptionId: string | null;
  correctAnswer: string | null;
  explanation: string;
}

interface VideoCheckpoint {
  id: string;
  timestampSeconds: number;
  question: CheckpointQuestion;
  isRequired: boolean;
}

interface CheckpointOverlayProps {
  checkpoint: VideoCheckpoint;
  onSubmit: (response: { selectedOptionId: string | null; textAnswer: string | null; isCorrect: boolean }) => void;
  onDismiss: () => void;
}

export default function CheckpointOverlay({ checkpoint, onSubmit, onDismiss }: CheckpointOverlayProps) {
  const { question } = checkpoint;
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [textAnswer, setTextAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  function handleSubmit() {
    let correct = false;

    if (question.type === "multiple_choice" || question.type === "true_false") {
      correct = selectedOptionId === question.correctOptionId;
    } else if (question.type === "short_answer") {
      correct = question.correctAnswer
        ? textAnswer.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase()
        : true; // No correct answer defined = accept any answer
    }

    setIsCorrect(correct);
    setSubmitted(true);
    onSubmit({
      selectedOptionId,
      textAnswer: textAnswer || null,
      isCorrect: correct,
    });
  }

  const canSubmit =
    (question.type === "multiple_choice" && selectedOptionId !== null) ||
    (question.type === "true_false" && selectedOptionId !== null) ||
    (question.type === "short_answer" && textAnswer.trim().length > 0);

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 rounded-t-xl">
      <div className="mx-4 w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-lg">
        <div className="mb-1 text-xs font-medium text-[var(--muted-foreground)] uppercase">
          Checkpoint Question
        </div>
        <h3 className="text-sm font-semibold">{question.questionText}</h3>

        <div className="mt-4 space-y-2">
          {(question.type === "multiple_choice" || question.type === "true_false") &&
            question.options.map((opt) => {
              const isSelected = selectedOptionId === opt.id;
              const showResult = submitted;
              const isCorrectOption = opt.id === question.correctOptionId;

              let optionClass = "border-[var(--border)] hover:bg-[var(--muted)]";
              if (showResult && isCorrectOption) {
                optionClass = "border-green-500 bg-green-50";
              } else if (showResult && isSelected && !isCorrectOption) {
                optionClass = "border-red-500 bg-red-50";
              } else if (isSelected && !showResult) {
                optionClass = "border-[var(--brand-primary)] bg-blue-50";
              }

              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={submitted}
                  onClick={() => setSelectedOptionId(opt.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${optionClass}`}
                >
                  {opt.text}
                </button>
              );
            })}

          {question.type === "short_answer" && (
            <input
              type="text"
              value={textAnswer}
              onChange={(e) => setTextAnswer(e.target.value)}
              disabled={submitted}
              placeholder="Type your answer..."
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
          )}
        </div>

        {submitted && (
          <div className={`mt-3 rounded-lg p-3 text-sm ${isCorrect ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            <span className="font-medium">{isCorrect ? "Correct!" : "Incorrect"}</span>
            {question.explanation && (
              <p className="mt-1 text-xs">{question.explanation}</p>
            )}
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          {!submitted ? (
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: "var(--brand-primary)" }}
            >
              Submit
            </button>
          ) : (
            <button
              onClick={onDismiss}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: "var(--brand-primary)" }}
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
