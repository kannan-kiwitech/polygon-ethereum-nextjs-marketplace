import { useState } from 'react'
import { ethers } from 'ethers'
import { create as ipfsHttpClient } from 'ipfs-http-client'
import { useRouter } from 'next/router'
import Web3Modal from 'web3modal'

const client = ipfsHttpClient('https://ipfs.infura.io:5001/api/v0')

import {
  nftaddress, nftmarketaddress
} from '../config'

import NFT from '../artifacts/contracts/NFT.sol/NFT.json'
import Market from '../artifacts/contracts/Market.sol/NFTMarket.json'

export default function CreateItem() {
  const [fileUrl, setFileUrl] = useState(null)
  const [formInput, updateFormInput] = useState({ price: '', name: '', description: '', properties: [] })
  const router = useRouter()

  const [propertyValues, setFormValues] = useState([{ nKey: "", nValue : ""}])

  let handleChange = (i, e) => {
    let newFormValues = [...propertyValues];
    newFormValues[i][e.target.name] = e.target.value;
    setFormValues(newFormValues);
    updateFormInput({ ...formInput, properties: propertyValues })
  }

  let addFormFields = () => {
      setFormValues([...propertyValues, { nKey: "", nValue: "" }])
      console.log('adding')
      console.log(JSON.stringify(propertyValues))
      updateFormInput({ ...formInput, properties: propertyValues })
      console.log(JSON.stringify(formInput))   
  }

  let removeFormFields = (i) => {
      let newFormValues = [...propertyValues];
      newFormValues.splice(i, 1);
      setFormValues(newFormValues)
  }



  async function onChange(e) {
    const file = e.target.files[0]
    try {
      const added = await client.add(
        file,
        {
          progress: (prog) => console.log(`received: ${prog}`)
        }
      )
      const url = `https://ipfs.infura.io/ipfs/${added.path}`
      setFileUrl(url)
    } catch (error) {
      console.log('Error uploading file: ', error)
    }  
  }
  async function createMarket() {
    const { name, description, price, properties } = formInput
    alert('JSON.stringify(properties)');
    alert(JSON.stringify(properties));
    if (!name || !description || !price || !fileUrl) return
    /* first, upload to IPFS */
    const data = JSON.stringify({
      name, description, properties, image: fileUrl
    })

    console.log(data)

    try {
      const added = await client.add(data)
      const url = `https://ipfs.infura.io/ipfs/${added.path}`
      console.log(url)
      /* after file is uploaded to IPFS, pass the URL to save it on Polygon */
      createSale(url)
    } catch (error) {
      console.log('Error uploading file: ', error)
    }  
  }

  async function createSale(url) {
    console.log('creating sale')
    const web3Modal = new Web3Modal()
    const connection = await web3Modal.connect()
    const provider = new ethers.providers.Web3Provider(connection)    
    const signer = provider.getSigner()
    console.log('signed')
    /* next, create the item */
    let contract = new ethers.Contract(nftaddress, NFT.abi, signer)
    let transaction = await contract.createToken(url)
    console.log('token creation in progresss')
    let tx = await transaction.wait()
    let event = tx.events[0]
    let value = event.args[2]
    let tokenId = value.toNumber()

    const price = ethers.utils.parseUnits(formInput.price, 'ether')
  
    /* then list the item for sale on the marketplace */
    contract = new ethers.Contract(nftmarketaddress, Market.abi, signer)
    let listingPrice = await contract.getListingPrice()
    listingPrice = listingPrice.toString()

    transaction = await contract.createMarketItem(nftaddress, tokenId, price, { value: listingPrice })
    console.log('creating marketsale')
    await transaction.wait()
    router.push('/')
  }

  return (
    <div className="flex justify-center">
      <div className="w-1/2 flex flex-col pb-12">
        <input 
          placeholder="Asset Name"
          className="mt-8 border rounded p-4"
          onChange={e => updateFormInput({ ...formInput, name: e.target.value })}
        />
        <textarea
          placeholder="Asset Description"
          className="mt-2 border rounded p-4"
          onChange={e => updateFormInput({ ...formInput, description: e.target.value })}
        />
        <input
          placeholder="Asset Price in Eth"
          className="mt-2 border rounded p-4"
          onChange={e => updateFormInput({ ...formInput, price: e.target.value })}
        />

        {propertyValues.map((element, index) => (
          <div className="mt-4 border rounded p-4" key={index}>
            <label>Property Name</label>
            <input type="text" name="nKey" className="mt-2 border rounded p-4" value={element.nKey || ""} onChange={e => handleChange(index, e)} />
            <label>Property Value</label>
            <input type="text" name="nValue" className="mt-2 border rounded p-4" value={element.nValue || ""} onChange={e => handleChange(index, e)} />
            {
              index ? 
                <button type="button"  className="button remove" onClick={() => removeFormFields(index)}>Remove</button> 
              : null
            }
          </div>
        ))}
        <div className="button-section">
              <button className="button add" type="button" onClick={() => addFormFields()}>Add Property</button>
        </div>



        <input
          type="file"
          name="Asset"
          className="my-4"
          onChange={onChange}
        />
        {
          fileUrl && (
            <img className="rounded mt-4" width="350" src={fileUrl} />
          )
        }
        <button onClick={createMarket} className="font-bold mt-4 bg-pink-500 text-white rounded p-4 shadow-lg">
          Create Digital Asset
        </button>
      </div>
    </div>
  )
}