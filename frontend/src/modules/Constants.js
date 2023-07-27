
export const API_URL = 'http://127.0.0.1:8000/';//this is a bad way to do this.  Whatever the flask server is set to

export const OUTCOMES = ['Overall Survival (4 Years)','FT','Aspiration rate Post-therapy','LRC']
export const DECISIONS = [
        'Decision 1 (Induction Chemo) Y/N',
        'Decision 2 (CC / RT alone)',
        'Decision 3 Neck Dissection (Y/N)'
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
]
export const continuousVars = [
'age',
'hpv',
'total_dose','dose_fraction','packs_per_year']

export const primaryDiseaseProgressions = ['CR Primary','PR Primary','SD Primary'];
export const nodalDiseaseProgressions = ['CR Nodal', 'PR Nodal', 'SD Nodal'];
export const primaryDiseaseProgressions2 = primaryDiseaseProgressions.map(d=> d + ' 2')
export const nodalDiseaseProgressions2 = nodalDiseaseProgressions.map(d=> d + ' 2')
export const dlts1 = [
        'DLT_Vascular',
        'DLT_Infection (Pneumonia)',
        'DLT_Other',
        'DLT_Neurological',
        'DLT_Hematological',
        'DLT_Dermatological',
        'DLT_Nephrological',
        'DLT_Gastrointestinal'
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