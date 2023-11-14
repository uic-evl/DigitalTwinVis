
export const API_URL = 'http://digitaltwin.evl.uic.edu:5000/';//this is a bad way to do this.  Whatever the flask server is set to

export const OUTCOMES = ['Overall Survival (4 Years)','FT','Aspiration rate Post-therapy','LRC']

export const TEMPORAL_OUTCOMES = ['OS (Calculated)','Locoregional control (Time)','FDM (months)','time_to_event']
export const FOURYEAR_OUTCOMES = TEMPORAL_OUTCOMES.map(s => s+'(4yr)')
export const DECISIONS = [
        'Decision 1 (Induction Chemo) Y/N',
        'Decision 2 (CC / RT alone)',
        'Decision 3 Neck Dissection (Y/N)'
]

export const DECISIONS_SHORT = [
        'IC',
        'CC',
        'ND',
]

export const ordinalVars = {
        'AJCC': [1,2,3,4],
        'N-category': [0,1,2,3],
        'T-category': [1,2,3,4],
        'Pathological Grade': [0,1,2,3,4],
        // 'hpv': [-1,0,1]
    }
export const booleanVars = [
        'Aspiration rate Pre-therapy',
        'bilateral',
        'gender',
        'subsite_BOT','subsite_Tonsil',
        'White/Caucasion','African American/Black','Hispanic/Latino',
]
export const continuousVars = [
'age',
'hpv',
'total_dose','dose_fraction','packs_per_year']

export const censorVars = ['Overall Survival (1=alive, 0=dead)','LRC','DC']

export const contVarGroups = {
        'age': [20,30,40,50,60,65,70,75,80,85,90,95],
        'dose_fraction': [1.8,2,2.1,2.2,2.3,3],
        'total_dose': [0,66,70,72],
        'pack_per_year': [0,10,20,30,40,50,60,70,90,100],
}


//order used in the model and returned values
const progressions = ['CR','PR','SD']
//ordre used for the user interface
const progressionsOrdinal = ['PD','SD','PR','CR'];
export const primaryDiseaseProgressions = progressions.map(s => s + ' Primary');
export const nodalDiseaseProgressions = progressions.map(s => s + ' Nodal')
export const primaryDiseaseProgressions2 = primaryDiseaseProgressions.map(d=> d + ' 2')
export const nodalDiseaseProgressions2 = nodalDiseaseProgressions.map(d=> d + ' 2')
export const progressionVars = {
        'Primary_Response_IC': progressionsOrdinal.map(s => s + ' Primary'),
        'Nodal_Response_IC': progressionsOrdinal.map(s => s + ' Nodal'),
        'Primary_Response_CC': progressionsOrdinal.map(s => s + ' Primary 2'),
        'Nodal_Response_CC': progressionsOrdinal.map(s => s + ' Nodal 2'),
}
export const dlts1 = [
        'DLT_Vascular',
        'DLT_Infection (Pneumonia)',
        'DLT_Other',
        'DLT_Neurological',
        'DLT_Hematological',
        // 'DLT_Dermatological',
        // 'DLT_Nephrological',
        // 'DLT_Gastrointestinal'
]
export const dlts2 = dlts1.map(d=>d + ' 2');

export const inductionModifications = [
        'no_dose_adjustment',
        'dose_modified',
        'dose_delayed',
        'dose_cancelled',
        'dose_delayed_&_modified',
        'regiment_modification',
        'unknown'
]

export const validSubsites = ['GPS','BOT','NOS','Pharyngeal_wall','Tonsil','Soft palate'];

export const noColor = '#af8dc3';
export const yesColor = '#7fbf7b';
export const divergingAttributionColors = ['#91bfdb','white','#fc8d59'];

export const dnnColor = '#762a83';
export const dnnColorNo = '#c2a5cf';
export const knnColor = '#1b7837';
export const knnColorNo = '#a6dba0';