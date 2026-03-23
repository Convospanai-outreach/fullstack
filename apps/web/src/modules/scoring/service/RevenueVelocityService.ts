
/**
 * Revenue Velocity Scoring (Bayesian Model)
 * 
 * Replaces weighted-sum scoring with a probabilistic model that treats 
 * "Time to Intent" as the primary signal.
 */

// Configurable constants - can be tuned per tenant
const DECAY_FACTOR_PER_HOUR = 0.98; // Score decays by 2% every hour of inactivity

export class RevenueVelocityService {

    /**
     * Updates the lead's intent score based on a new event.
     * Uses Bayesian update rule: P(Intent | Event)
     */
    calculateNewScore(currentScore: number, eventType: string, timeSinceLastEventMinutes: number): number {
        // 1. Apply Time Decay first
        const decayHours = timeSinceLastEventMinutes / 60;
        const decayedScore = currentScore * Math.pow(DECAY_FACTOR_PER_HOUR, decayHours);

        // 2. Determine Likelihood P(Event | Intent) / P(Event | ~Intent)
        // This likelihood ratio represents the "strength" of the signal
        const likelihoodRatio = this.getLikelihoodRatio(eventType);

        // 3. Update using Bayes Rule (in Odds form)
        // Posterior Odds = Prior Odds * Likelihood Ratio
        const priorOdds = decayedScore / (1 - decayedScore);
        const posteriorOdds = priorOdds * likelihoodRatio;

        // Convert back to probability
        const newScore = posteriorOdds / (1 + posteriorOdds);

        return Math.min(newScore, 0.999); // Cap at 99.9%
    }

    private getLikelihoodRatio(eventType: string): number {
        switch (eventType) {
            case "PRICING_PAGE_VIEW": return 5.0; // Very strong signal
            case "EMAIL_REPLY_POSITIVE": return 10.0;
            case "EMAIL_OPEN": return 1.2; // Weak signal
            case "LINKEDIN_CONNECT": return 3.0;
            default: return 1.1;
        }
    }

    /**
     * Calculates the "Velocity" (Rate of change of score)
     * High velocity = Urgent action needed
     */
    calculateVelocity(oldScore: number, newScore: number, timeDeltaHours: number): number {
        if (timeDeltaHours <= 0) return 0;
        return (newScore - oldScore) / timeDeltaHours;
    }
}

export const revenueVelocityService = new RevenueVelocityService();
