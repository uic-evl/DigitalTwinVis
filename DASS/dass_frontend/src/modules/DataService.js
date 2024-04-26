import * as constants from './Constants';
const querystring = require('querystring-es3');

export default class DataService {

    constructor(args){
        this.axios = require('axios');
        this.api = this.axios.create({
            baseURL: constants.API_URL,
        })
    }

    fixFeatures(array){
        if(array === undefined | array === null){
            return array
        }
        let newArray = [];
        const vMap = {'mean': 'mean_dose','min': 'min_dose','max': 'max_dose'}
        for(let i in array){
            if(vMap[array[i]] !== undefined){
                newArray[i] = vMap[array[i]]
            } else{
                newArray[i] = array[i];
            }
        }
        return newArray
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
            let pstring = querystring.stringify(newParams);
            paramQuery = paramQuery + '?' + pstring
        }
        return paramQuery
    }

    async testPost(data){
        console.log('testing post')
        if(data === undefined){
            data = {'test': [1,2,3,4,4],'test2': 'lol'}
        }
        try{
            this.api.post('/test', data).then(response => {
                console.log('test post respsonse',response)
            }).catch(error => {
                console.log('test post error',error);
            })
        } catch(error){
            console.log(error)
        }
    }

    async getClusterMetrics(clusterData,lrtConfounders,symptom,modelType,dates){
        let postData = {
            'clusterData': clusterData,
            'lrtConfounders':lrtConfounders,
            'symptom': symptom,
            'modelType':modelType,
            'symptom_dates':dates,
        }
        let goodPostData = {}
        for(let key of Object.keys(postData)){
            let entry = postData[key];
            if(entry !== undefined){
                goodPostData[key] = entry
            }
        }
        if(goodPostData.clusterData === undefined){
            return undefined
        }
        console.log('metrics post data',goodPostData)
        try{
            const response = await this.api.post('/cluster_metrics', goodPostData);
            // console.log('cluster metrics response',response.data);
            return response.data;
        } catch(error){
            console.log(error);
        }

    }

    async getClusterRules(
        clusterData,organs,
        symptoms,organFeatures,
        threshold,cluster,
        maxDepth,maxRules,
        ruleCriteria,predictCluster,
        minInfo,
        dates,
        ){
        let postData = {
            'clusterData': clusterData,
            'organs': organs,
            'symptoms': symptoms,
            'clusterFeatures': this.fixFeatures(organFeatures),
            'threshold': threshold,
            'cluster': cluster,
            'max_depth': maxDepth,
            'max_rules': maxRules,
            'criteria': ruleCriteria,
            'predictCluster': predictCluster,
            'min_info': minInfo,
            'symptom_dates':dates,
        }
        let goodPostData = {}
        for(let key of Object.keys(postData)){
            let entry = postData[key];
            if(entry !== undefined){
                goodPostData[key] = entry
            }
        }
        // console.log('rule post data',goodPostData)
        if(goodPostData.clusterData === undefined){
            return undefined
        }
        try{
            var response = await this.api.post('/rules', goodPostData);
            response.postData = postData;
            // console.log('rules response',response);
            return response;
        } catch(error){
            console.log(error);
        }

    }

    async getLRTests(clusterData,
        dates,
        confounders,
        thresholds,
        symptoms,
        ){
        let postData = {
            'clusterData': clusterData,
            'confounders':confounders,
            'symptoms': symptoms,
            'thresholds': thresholds,
            'endpoints':[dates],
        }
        let goodPostData = {}
        for(let key of Object.keys(postData)){
            let entry = postData[key];
            if(entry !== undefined){
                goodPostData[key] = entry;
            }
        }
        // console.log('rule post data',goodPostData)
        if(goodPostData.clusterData === undefined){
            return undefined;
        }
        try{
            const response = await this.api.post('/lrt', goodPostData);
            // console.log('rules response',response.data);
            return response.data;
        } catch(error){
            console.log(error);
        }

    }

    async getDoseJson(organs,clusterFeatures){
        try{
            var params = {
                'organs': organs,
                'features': this.fixFeatures(clusterFeatures),
            };
            let qString = '/doses'
            qString += this.getParamList(params)
            const dDataResponse = await this.api.get(qString);
            console.log('dose data',params);
            console.log(dDataResponse);
            return dDataResponse;
        } catch(error){
            console.log(error)
        }
    }
    
    async getDoseClusterJson(organs,nClusters,clusterFeatures,clusterType,lrtConfounders,symptoms,dates){
        try{
            var params = {
                'organs': organs,
                'nClusters':nClusters,
                'clusterFeatures':this.fixFeatures(clusterFeatures),
                'clusterType':clusterType,
                'confounders':lrtConfounders,
                'symptoms':symptoms,
                'dates':dates,
            }
            let qstring = '/dose_clusters';
            qstring += this.getParamList(params)
            // console.log('clusterstring',qstring)
            const dDataResponse = await this.api.get(qstring);
            // console.log('dose cluster data');
            // console.log(dDataResponse);
            return dDataResponse;
        } catch(error){
            console.log(error)
        }
    }

    async getAdditiveOrganClusterEffects(baseOrgans,nClusters,features,clusterType,
        symptom,confounders,thresholds,clusters,dates){
        try{
            let params = {
                symptom:symptom,
                clusterType:clusterType,
                nClusters:nClusters,
                features:this.fixFeatures(features),
                baseOrgans:baseOrgans,
                confounders:confounders,
                thresholds:thresholds,
                clusters:clusters,
                dates:dates,
            }
            let qstring = '/single_organ_effects';
            qstring += this.getParamList(params);
            console.log('additiveClusterString',qstring)
            const dataResponse = await this.api.get(qstring);
            // console.log('additiveClusterEffectData',dataResponse);
            return dataResponse
        }catch(error){
            console.log('error getting additive cluster effects',error);
        }
    }


    async getOrganJson(){
        try{
            const oDataResponse = await this.api.get('/organ_values_denoised');
            // console.log('organ data');
            // console.log(oDataResponse);
            return oDataResponse;
        } catch(error){
            console.log(error)
        }
    }

    async getOrganClusterJson(){
        try{
            const oDataResponse = await this.api.get('/organ_clusters');
            // console.log('organ clusters');
            // console.log(oDataResponse);
            return oDataResponse;
        } catch(error){
            console.log(error)
        }
    }

    async getSymptomJson(){
        try{
            const sDataResponse = await await this.api.get('/mdasi');
            // console.log('symptom data');
            // console.log(sDataResponse);
            return sDataResponse;
        } catch(error){
            console.log(error)
        }
    }

    async getSymptomClusterJson(){
        try{
            const sDataResponse = await await this.api.get('/symptom_clusters');
            // console.log('symptom clusters');
            // console.log(sDataResponse);
            return sDataResponse;
        } catch(error){
            console.log(error)
        }
    }


}