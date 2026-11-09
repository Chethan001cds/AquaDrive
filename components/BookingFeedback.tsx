"use client";

import { useState, useEffect } from "react";
import { submitBookingFeedback, getCachedFeedback } from "../lib/bookings";

interface BookingFeedbackProps {
  bookingId: string;
  bookingRef?: string;
  customerEmail?: string;
  initialRating?: number;
  initialFeedback?: string;
  feedbackSubmittedAt?: string;
  completedByName?: string;
  onFeedbackSaved?: (rating: number, feedback: string) => void;
  compact?: boolean;
}

const RATING_LABELS: Record<number, string> = {
  1: "Needs Improvement 😞",
  2: "Fair 😐",
  3: "Good 🙂",
  4: "Very Good 😊",
  5: "Excellent! Loved the wash 🌟",
};

export default function BookingFeedback({
  bookingId,
  bookingRef,
  customerEmail,
  initialRating,
  initialFeedback,
  feedbackSubmittedAt,
  completedByName,
  onFeedbackSaved,
  compact = false,
}: BookingFeedbackProps) {
  // Check local cache if server hasn't populated yet
  const cached = typeof window !== "undefined" ? getCachedFeedback(bookingId) : null;

  const currentRating = initialRating || cached?.rating || 0;
  const currentFeedback = initialFeedback || cached?.feedback || "";
  const currentSubmittedAt = feedbackSubmittedAt || cached?.submittedAt || "";

  const [rating, setRating] = useState<number>(currentRating || 5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [feedback, setFeedback] = useState<string>(currentFeedback);
  const [isEditing, setIsEditing] = useState<boolean>(!currentRating);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    if (currentRating) {
      setRating(currentRating);
      setFeedback(currentFeedback);
      setIsEditing(false);
    }
  }, [currentRating, currentFeedback]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1 || rating > 5) {
      setErrorMsg("Please select a rating between 1 and 5 stars");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await submitBookingFeedback(
        bookingId,
        rating,
        feedback,
        customerEmail
      );

      if (res.success) {
        setSuccessMsg("🎉 Thank you! Your review has been saved.");
        setIsEditing(false);
        if (onFeedbackSaved) {
          onFeedbackSaved(rating, feedback);
        }
      } else {
        setErrorMsg(res.error || "Failed to submit review");
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  }

  const activeStarCount = hoverRating || rating;

  // READ-ONLY / SUBMITTED DISPLAY
  if (!isEditing && currentRating > 0) {
    return (
      <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/70 via-orange-50/40 to-yellow-50/60 p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/50 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">⭐</span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-amber-800">
                Your Service Feedback
              </p>
              {completedByName && (
                <p className="text-xs text-amber-900 font-medium">
                  Service performed by: <span className="font-bold">{completedByName}</span>
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="self-start sm:self-auto inline-flex items-center gap-1 rounded-xl bg-white border border-amber-300 px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100/70 shadow-sm transition"
          >
            <span>✏️</span> Edit Review
          </button>
        </div>

        {/* Stars */}
        <div className="mt-3 flex items-center gap-2">
          <div className="flex text-amber-400 text-xl tracking-tight">
            {[1, 2, 3, 4, 5].map((star) => (
              <span key={star}>
                {star <= currentRating ? "★" : "☆"}
              </span>
            ))}
          </div>
          <span className="rounded-md bg-amber-200/80 px-2 py-0.5 text-xs font-extrabold text-amber-900">
            {currentRating} / 5 Stars
          </span>
          <span className="text-xs font-medium text-amber-700 hidden sm:inline">
            ({RATING_LABELS[currentRating] || ""})
          </span>
        </div>

        {/* Written Review */}
        {currentFeedback ? (
          <blockquote className="mt-3 rounded-xl bg-white/90 p-3 text-sm text-gray-800 italic border border-amber-100 shadow-inner">
            "{currentFeedback}"
          </blockquote>
        ) : (
          <p className="mt-2 text-xs text-amber-700 italic">No written feedback provided.</p>
        )}

        {currentSubmittedAt && (
          <p className="mt-2 text-[11px] text-amber-600">
            Submitted on {new Date(currentSubmittedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        )}
      </div>
    );
  }

  // INTERACTIVE FEEDBACK FORM
  return (
    <div className="rounded-2xl border border-blue-200 bg-white p-4 sm:p-5 shadow-sm">
      <div className="border-b border-gray-100 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">✨</span>
            <div>
              <h4 className="text-sm sm:text-base font-bold text-gray-900">
                Rate Your Doorstep Service
              </h4>
              <p className="text-xs text-gray-500">
                {completedByName
                  ? `Completed by ${completedByName}. How was your experience?`
                  : "Help us improve our service with your honest feedback."}
              </p>
            </div>
          </div>
          {currentRating > 0 && (
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="text-xs font-semibold text-gray-500 hover:text-gray-800"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {/* Star Rating Picker */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
            Tap Stars to Rate (1 to 5) *
          </label>
          <div className="flex items-center gap-1.5 sm:gap-2">
            {[1, 2, 3, 4, 5].map((star) => {
              const filled = star <= activeStarCount;
              return (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-1 text-2xl sm:text-3xl transition-transform hover:scale-125 focus:outline-none"
                  aria-label={`${star} star`}
                >
                  <span className={filled ? "text-amber-400" : "text-gray-300"}>
                    {filled ? "★" : "☆"}
                  </span>
                </button>
              );
            })}

            <span className="ml-2 text-xs sm:text-sm font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
              {RATING_LABELS[activeStarCount] || `${activeStarCount} Stars`}
            </span>
          </div>
        </div>

        {/* Written Review */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
            Write Your Feedback & Suggestions
          </label>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={compact ? 2 : 3}
            placeholder="Share details about the wash quality, cleaner punctuality, vehicle shine, or areas we can improve..."
            className="w-full rounded-xl border border-gray-300 p-3 text-sm text-gray-800 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {errorMsg && (
          <p className="rounded-lg bg-red-50 p-2.5 text-xs font-medium text-red-700">
            ⚠️ {errorMsg}
          </p>
        )}

        {successMsg && (
          <p className="rounded-lg bg-green-50 p-2.5 text-xs font-semibold text-green-800">
            {successMsg}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md hover:shadow-lg disabled:opacity-50 transition"
          >
            {submitting ? (
              <span>Saving feedback…</span>
            ) : (
              <>
                <span>⭐</span>
                <span>{currentRating > 0 ? "Update Feedback" : "Submit Rating & Feedback"}</span>
              </>
            )}
          </button>
          {currentRating > 0 && (
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="text-xs font-semibold text-gray-600 hover:text-gray-900 px-3 py-2"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

