import axios from 'axios';
import * as constants from './Constants';
export default class DataService {

    constructor(token,setAuthToken){
        const headers = token? {
            Authorization: token ? `Bearer ${token}` : undefined,
            'Content-Type': 'application/json',
          } : {};

        this.api = axios.create({
            baseURL: constants.API_URL,
            headers: headers,
        });
        this.resetToken = ()=>setAuthToken(false);
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

    async getMahalanobisHistogram(){
        let qstring = '/mahalanobis_histogram'
        try{
            let response = await this.api.get(qstring)
            return response.data;
        }
        catch(error){
            if(error.response.status == 401){
                this.resetToken();
            }
        }
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
            if(error.response.status == 401){
                this.resetToken();
            } else{
                console.log('error in getPatientData');
                console.log(error);
            }
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
            if(error.response.status == 401){
                this.resetToken();
            } else{
                console.log('error in getPatientEmbeddings');
                console.log(error);
            }
        }
        
    }

    async getDefaultPredictions(){
        try{
            const response = await this.api.get('/defaultPredictions');
            return response.data;
        } catch(error){
            if(error.response.status == 401){
                this.resetToken();
            } else{
                console.log('error in getDefaultPredictions');
                console.log(error);
            }
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
            if(error.response.status == 401){
                this.resetToken();
            } else{
                console.log('error in getcohortPredictions');
                console.log(error);
            }
        }
    }

    async getPatientSimulation(patientFeatures,currModel,state=0){
        let goodPostData = {'state': state,'model': currModel}
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
            if(error.response.status == 401){
                this.resetToken();
            } else{
                console.log('error in getPatientSimulation');
                console.log(error);
            }
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
            if(error.response.status == 401){
                this.resetToken();
            } else{
                console.log('error in getPatientNeighbors');
                console.log(error);
            }
        }
    }


}