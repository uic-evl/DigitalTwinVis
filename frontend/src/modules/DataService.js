import axios from 'axios';
import * as constants from './Constants';
export default class DataService {

    constructor(args){
        this.api = axios.create({
            baseURL: constants.API_URL,
        })
    }

    getParamList(pObj){
        let newParams = {}
        let empty= true;
        for(let k of Object.keys(pObj)){
            if(pObj[k] !== undefined & pObj[k] !== null){
                newParams[k] = pObj[k];
                empty = false;
            }
        }
        let paramQuery = '';
        if(!empty){
            let pstring = new URLSearchParams(newParams);
            paramQuery = paramQuery + '?' + pstring
        }
        return paramQuery
    }

    async getPatientData(patientIds,fields){
        try{
            var params = {
                'patientIds': patientIds,
                'patientFields': fields,
            }
            let qstring = '/patientdata';
            qstring += this.getParamList(params);
            // console.log('patientdata qstring',qstring);
            const response = await this.api.get(qstring);
            return response.data;
        } catch(error){
            console.log('error in getPatientData');
            console.log(error);
        }
        
    }

    async getPatientEmbeddings(patientIds,fields){
        try{
            var params = {
                'patientIds': patientIds,
                'patientFields': fields,
            }
            let qstring = '/patientembeddings';
            qstring += this.getParamList(params);

            const response = await this.api.get(qstring);
            return response.data;
        } catch(error){
            console.log('error in getPatientEmbeddings');
            console.log(error);
        }
        
    }

    async getCohortPredictions(patientIds){
        try{
            var params = {
                'patientIds': patientIds,
            }
            let qstring = '/cohortPredictions';
            qstring += this.getParamList(params);

            const response = await this.api.get(qstring);
            return response.data;
        } catch(error){
            console.log('error in getCohortPredictions');
            console.log(error);
        }
    }

    async getPatientSimulation(patientFeatures){
        let goodPostData = {}
        for(let key of Object.keys(patientFeatures)){
            let entry = patientFeatures[key];
            if(entry !== undefined & entry !== null){
                goodPostData[key] = entry;
            }
        }
    
        try{
            var response = await this.api.post('/newpatient',goodPostData);
            response.postData = goodPostData;
            return response;
        } catch(error){
            console.log('error in getPatientSimulation');
            console.log(error)
        }
    }

    async getPatientNeighbors(patientFeatures,neighbors,state){
        let goodPostData = {}
        for(let key of Object.keys(patientFeatures)){
            let entry = patientFeatures[key];
            if(entry !== undefined & entry !== null){
                goodPostData[key] = entry;
            }
        }
    
        let params = {
            'n_neighbors': neighbors,
            'state': state,
        }
        let qstring = '/neighbors' + this.getParamList(params);
        // console.log('neighborquery',qstring);
        try{
            var response = await this.api.post(qstring,goodPostData);
            response.postData = goodPostData;
            return response;
        } catch(error){
            console.log('error in getPatientNeighbors');
            console.log(error)
        }
    }


}