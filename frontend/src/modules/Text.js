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

export const subsiteHelpText = "Subsite of the main tumor. Double click to change/remove tumor. </br> Deselect all to indicate a tumor not otherwise specificied"
        + '</br> Available Subsites: '
        + "</br> BOT (Base of Tongue)" 
        + '</br> Tonsil'
        + '</br> Soft Palate'
        + '</br> GPS (Glossalpharyngeal Sulcus)'
        + '</br> Pharnygeal Wall';