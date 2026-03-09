ALTER TABLE "AssessmentPolicy"
ADD COLUMN "introDescription" TEXT NOT NULL DEFAULT 'You will answer personality items and practical workplace scenarios. There are no "wrong" answers. Choose what best reflects your natural style.',
ADD COLUMN "introBullets" TEXT[] NOT NULL DEFAULT ARRAY[
  'Set aside 10-15 minutes without interruption.',
  'Respond honestly to maximize insight quality.',
  'You can complete in one sitting and submit once all questions are answered.'
]::TEXT[];