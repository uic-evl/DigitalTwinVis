export const distHelpText = 'Mahalanobis Distance (using model activation for the specific decision) between the patient and the cohort, relative to the distances for the actual cohort.'
+ '</br></hr> Lower values indicate that the patient is similar to the cohort and thus the models are more reliable.'
+ '</br> Higher values suggest the patient may be and outlier and thus the models may be inaccurate.';

export const recHelpText = 'Rec: Recommended Treatment by the model as a percentage of confidence in prescribing the selected treatment.'
+ '</br> Sim Patients: % of similar patients that recieved the treatment in the training cohort';

export const modelHelpText = 'Determines if the system uses a model trained to identify the "optimal" decision based on minimizing predicted negative outcomes' 
+'</br> Or the model trained to imitate the decisions made in the training data by physicians';
export const decisionHelpText = 'The decision being inspected.'
+'</br> IC: Induction Chemo </br> CC: Concurrent Chemotherapy (with RT) </br> ND: Neck Dissection (after RT)';
export const fixHelpText = 'By default, we calculate outcomes assuming we use the model decisions. This allows you to override those decisions and use fixed Y/N outcomes for each decision in the model.';

export const featureHelpText = 'Patient Features needed for the model. Dark bars indicate current values,'
+ '</br> while bold outlines indicate values set to be changed when you push "run changes" at the bottom.'
+ '</br> Select "reset" to empy the queued values.';

export const LNHelpText = 'Map of affected lymph node regions. Left indicates ipsilateral (same side as main tumor) while Right side indicates contraleral nodes.'
        +'</br> Double Click to add/remove a node.'
        +'</br> Colors indicate the impact of an affected LN on the model decision';

export const subsiteHelpText = "Subsite of the main tumor. Double click to change/remove site. </br> Deselect all to indicate a tumor not otherwise specificied"
        + '</br> Available Subsites: '
        + "</br> BOT (Base of Tongue)" 
        + '</br> Tonsil'
        + '</br> Soft Palate'
        + '</br> GPS (Glossalpharyngeal Sulcus)'
        + '</br> Pharnygeal Wall';
export const outcomeHelpText = "This shows the predicted outcomes for the patient using the cohort with and without undergoing the selected treatment."
        + "</br> Blue bars are outcome predictions using the neural network and include 95% confidence intervals using models trained on subsets of the cohort."
        + "</br> Green bars are outcome predictions using similar patients in the cohort that recieved or didn't recieved treatment. Patients are selected to minimize the effects of confounders using the imitation model.";

export const attributionHelpText = 'Estimated impact of each feature on the model decision. Numbers are relative to the median features of the training cohort.'

export const scatterplotHelpText = "Model activations for the training cohort embedded into 2 dimensions. Inner circle color represents the true decision while outer color represents the model decision."
        + "</br> The main patient is the largest circle in blue while the most similar patients are shown in green. All other patients are shown in greyscale.";

export const simHelpText = "Summary of features of the most similar patients that did and didn't receive treatment."
        + "</br>The top two rows are averages of the treated and untreated groups, respectively."
        + "</br> The remaining patients are shown in order of similarity."
        + "</br>The DLT row shows images for potential dose-limiting toxicities. Blue outlines show the features for the current patient."