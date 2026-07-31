/**
 * Survey Act Cap 299 (Kenya) - Critical Tolerances and Rules
 * 
 * This module encodes the legal tolerances and surveying rules
 * from the Kenyan Survey Act Cap 299 for injection into the Local LLM's context.
 */

export const CAP_299_KNOWLEDGE = `
SURVEY ACT CAP 299 (KENYA) - REFERENCE DATA

1. TRAVERSE MISCLOSURES:
- Urban/Township Cadastral Surveys (Class A): The linear misclosure shall not exceed 1 in 10,000.
- Rural Cadastral Surveys (Class B): The linear misclosure shall not exceed 1 in 4,000.
- Agricultural/Ranching (Class C): The linear misclosure shall not exceed 1 in 2,000.

2. ANGULAR MISCLOSURES:
- Class A & B: Maximum angular misclosure = 30" * sqrt(N), where N is the number of stations.
- Class C: Maximum angular misclosure = 60" * sqrt(N), where N is the number of stations.

3. DISTANCE MEASUREMENTS:
- All distances must be reduced to the horizontal plane at mean sea level (MSL).
- Scale factor corrections (UTM / Arc 1960) must be applied to all measured distances.
- Steel bands must be standardized at 20°C and 50 N tension.

4. BEARING AND DATUM:
- All bearings shall be recorded in degrees, minutes, and seconds.
- A traverse must be tied to at least two known Government control points (Trig points or established survey marks).
- If control points are destroyed, the surveyor must reinstate them or report to the Director of Surveys.

5. FIELD NOTES (FIELD BOOK):
- Must be written in black or blue indelible ink.
- Erasures are strictly prohibited. Corrections must be crossed out with a single line and initialed.
- Must include instrument details, weather conditions, date, and names of the survey party.

6. BOUNDARY BEACONS:
- Standard corner beacons: Angle iron set in concrete, minimum 15cm above ground.
- If a beacon cannot be placed exactly on the corner (e.g., in a river), an offset beacon (witness mark) must be placed on the boundary line and its distance recorded.

7. SAFETY AND DISCLAIMERS:
- An AI cannot approve or certify a survey plan. 
- Only a Licensed Surveyor registered under the Survey Act can authenticate a survey.
- Any advice given regarding misclosures or rules must end with a reminder that the Director of Surveys is the final authority.
`
