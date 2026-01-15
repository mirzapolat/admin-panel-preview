/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("w8fk5er1yau5gtd")

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "rdade6dr",
    "name": "identification",
    "type": "number",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {
      "min": null,
      "max": null,
      "noDecimal": false
    }
  }))

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("w8fk5er1yau5gtd")

  // remove
  collection.schema.removeField("rdade6dr")

  return dao.saveCollection(collection)
})
