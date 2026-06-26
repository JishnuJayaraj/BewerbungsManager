Job Search API
Schnittstelle zum schnellen Durchsuchen des HR4YOU Job Pools.
Authorization
Für jede Request muss der Header Authorization mit einem gültigen Token gesetzt werden.
Autocomplete
Liefert Job Vorschläge für die gegebene Phrase.
Autocomplete Request
• Method: GET
• URI: /autocomplete
Autocomplete GET Parameter
• phrase: Phrase, die vervollständigt werden soll (muss gesetzt und mindestens ein Zeichen lang sein)
• size: Anzahl der Jobs, welche max. zurückgegeben werden (optional, default = 10)
Autocomplete Response Code
Erwarteter Status Code: 200 OK
Autocomplete Response Body
[
{
"uuid": "708784a9-01df-4d08-b28e-fc4a34825478",
"link": "https://de.indeed.com/viewjob?jk=65461f27286a2a25",
"company": "CAS Software AG",
"companyCleaned": "CAS Software AG",
"text": {
"title": "Praktikum Softwareentwicklung Java HTML5 JavaScript",
"titleCleaned": "Praktikum Softwareentwicklung Java HTML5 JavaScript",
"fulltext": "<div id=\"jobDescriptionText\" class=\"jobsearch-JobComponent-description css-wppltw eu4oa1w0"company": "",
"tasks": [
" - Mitarbeit in disziplin\u00fcbergreifenden Scrum-Teams zur Weiterentwicklung unserer\n Prod" - Integration in Entwicklungsteams und -aufgaben mit direkter Anwendung agiler\n Softwareent" - Entwicklung innovativer Produkte und Kundenl\u00f6sungen, wobei die eingesetzten\n Technol" - Sicherstellung von Qualit\u00e4t durch Clean Code, automatisierte Tests und Code Reviews.",
" - Anwendung von Continuous Integration Tools wie Jenkins, Maven und Git."
],
"requirements": [
" - Du studierst in einem informatikorientierten Studiengang.",
" - Du bist nicht mehr gr\u00fcn hinter den Ohren, wenn es um Softwareentwicklung mit\n objekt" - Du m\u00f6chtest an einem realen Projekt oder Produkt mitarbeiten\u2013 mit echten\n Herau" - Wir sind als innovatives Unternehmen bekannt, darum solltest du neugierig sein, um neue\n ],
"benefits": [
" <p> Neben unserer Wir-Kultur und dem Fokus auf gesunde Beziehungen bieten wir unseren\n Mitgestalter" Auf dich wartet fachliches und pers\u00f6nliches Mentoring durch deine Patin bzw.\n deinen Paten. Vo" In unserem Culinarium erh\u00e4ltst du Studierenden-Rabatt und tankst Energie f\u00fcr die\n zweite" Wir haben ein gro\u00dfes Netzwerk aus Studierenden, mit denen du dich auf unseren\n Studi-Events, w],
"closing": ""
},
"period": {
"dateFrom": "2025-02-03",
"dateTo": null
1
},
"addresses": [
{
"place": "Karlsruhe",
"country": "DE",
"county": "Prignitz",
"zipCode": "19322",
"street": null,
"streetNumber": null,
"coordinates": {
"lat": 53.0,
"lon": 11.75
}
}
],
"counterpart": {
"firstName": "",
"lastName": "",
"role": "",
"department": "",
"phone": "",
"fax": "",
"email": "",
"address": {
"place": "",
"country": "",
"county": "",
"zipCode": "",
"street": null,
"streetNumber": null,
"coordinates": null
}
},
"classifications": {
"companyType": "COMPANY",
"contractTypes": [
"PERMANENT"
],
"employmentTypes": [
"FULL_TIME"
],
"jobTypes": [
"INTERNSHIP"
],
"occupationAreas": [
"IT"
],
"werNERTags": [
{
"text": "Praktikum",
"label": "TYPE",
"category": null
},
{
"text": "Softwareentwicklung",
"label": "SUBJECT",
"category": null
},
{
"text": "Java",
"label": "SUBJECT",
2
"category": null
},
{
"text": "JavaScript",
"label": "SUBJECT",
"category": null
}
],
"experienceLevel": "UNDEFINED",
"taxonomyJobTitle": {
"text": "Nicht zugeordnet",
"label": "Nicht zugeordnet",
"category": "Nicht zugeordnet"
},
"itSkills": [],
"softSkills": [
{
"text": "innovativ",
"label": "Innovation",
"category": "Kreativit\u00e4t"
},
{
"text": "neugier",
"label": "Neugier",
"category": "Lernbereitschaft"
}
]
},
"skillTags": [
{
"text": "informatikorientierten Studiengang.",
"label": "requirement_Wissensgebiet",
"category": null
},
{
"text": "gr\u00fcn",
"label": "requirement_Soft Skill",
"category": null
},
{
"text": "den Ohren",
"label": "requirement_Soft Skill",
"category": null
},
{
"text": "Softwareentwicklung mit objektorientierten Technologien",
"label": "requirement_IT Skill",
"category": null
},
{
"text": "innovatives",
"label": "requirement_Soft Skill",
"category": null
},
{
"text": "neugierig",
"label": "requirement_Soft Skill",
"category": null
},
{
"text": "Wege zu erkunden.",
3
"label": "requirement_Soft Skill",
"category": null
}
],
"score": 74.33926,
"highlights": {}
}
]
Search
Liefert Jobs, welche auf die gegebenen Suchbegriffe und Filter passen.
Search Request
• Method: POST
• URI: /search
Search Request Body
{
"filters": [
{
"type": "distance",
"lat": 53.364150,
"lon": 7.522625,
"distance": 20
}
],
"queries": [
{
"phrase": "Linux",
"fields": [
"text.title",
"company"
],
"type": "single"
}
],
"size": 10,
"page": 5
}
Search POST Parameter
• aggregations: eine Liste von Aggregationen, welche für die aktuelle Suche durchgeführt werden sollen
• filters: eine Liste von Filtern, welche auf angegebene Felder angewendet werden sollen
• highlighting: aktivieren und einstellen der Rückgabe der Textstellen von gefundenen Queries
• queries: eine List von Phrasen, mit welchen in angegebenen Feldern gesucht werden soll
• page: Seite, bei welcher begonnen werden soll (die erste Seite hat die Nummer 1)
• size: Anzahl der Jobs, welche max. zurückgegeben werden (optional, default = 20)
• sort: setzt die Sortierung der Stellenangebote
Sortierung
Die zurückgegebenen Stellenangebote werden standardmäßig absteigend nach dem Erstellungsdatum sortiert. Um eine andere
Sortierung zu erhalten, muss das Feld sort gesetzt werden.
Dafür sind die folgenden Felder erforderlich:
• field: Feld, nach welchem sortiert werden soll; die folgenden Felder sind möglich:
– uuid
– company
4
– link
– text.title
– text.fulltext
– text.company
– text.tasks
– text.requirements
– text.benefits
– text.closing
– addresses.country
– addresses.county
– addresses.place
– addresses.zipCode
– period.dateFrom
• order: definiert, ob auf- oder absteigend sortiert werden soll (default: ASC); mögliche Werte:
– ASC
– asc
– DESC
– desc
Beispiel:
{
"sort": {
"field": "text.title",
"order": "ASC"
}
}
Queries
Mithilfe von Queries kann in Textfeldern gesucht werden. Queries werden unter dem Key queries im Request Body angegeben.
SinglePhrase Query
Felder:
• autocomplete: Wenn auf true gesetzt, werden auch Teiltreffer der Phrase berücksichtigt (default: false)
• fields: eine Liste von Feldern, in denen gesucht werden soll (erforderlich); Mögliche Werte:
– uuid
– company
– text.title
– text.fulltext
– text.company
– text.tasks
– text.requirements
– text.benefits
– text.closing
– addresses.country
– addresses.county
– addresses.place
– addresses.zipCode
• phrase: Phrase, mit welcher gesucht werden soll (erforderlich)
• queryType: Art der Query (default: should); Mögliche Werte:
– must: die Phrase muss enthalten sein
– should: Jobs, welche diese Phrase beinhalten, werden weiter oben in der Liste angezeigt
– must_not: Jobs, welche diese Phrase beinhalten, werden vom Ergebnis ausgeschlossen
Beispiel:
{
"queries": [
5
{
"autocomplete": false,
"fields": [
"text.title",
"text.fulltext"
],
"phrase": "Linux",
"queryType": "must",
"type": "single"
}
]
}
MultiPhrase Query
Felder:
• fields: eine Liste von Feldern, in denen gesucht werden soll (erforderlich)
• phrases: List von Phrases, mit denen gesucht werden soll (erforderlich)
• queryType: Art der Query (default: should); Mögliche Werte:
– must: Mindestens einer der angegebenen Phrasen muss vorkommen
– should: Jobs, welche diese Phrasen beinhalten, werden weiter oben in der Liste angezeigt
Beispiel:
{
"queries": [
{
"fields": [
"text.title",
"text.fulltext"
],
"phrases": [
"Linux",
"Windows",
"MacOS"
],
"queryType": "must",
"type": "multi"
}
]
}
Semantic Query
Suchen von Stellenangeboten mit ähnlichem Inhalt zum Text. Nutzt ein KI-Modell zum Abgleich.
Felder:
• phrase: freitext, welcher zum abgleichen verwendet wird (erforderlich, wenn phrases nicht gesetzt)
• phrases: Liste von freitexten, welcher zum abgleichen verwendet wird (erforderlich, wenn phrase nicht gesetzt)
• queryType: Art der Query (default: should); Mögliche Werte:
– must: das Stellenangebot muss ähnlich zum angegebenen sein
– should: das Stellenangebot sollte ähnlich zum angegebenen sein
{
"queries": [
{
"phrase": "Erfahrung in der Java Entwicklung. Tools wie Maven, Gradle sowie das Spring Framework.",
"queryType": "must",
"type": "semantic"
}
6
]
}
Filter
Filter werden unter dem Key filters im Request Body angegeben. Der Key type gibt den Typen des jeweiligen Filters an und
muss gesetzt werden.
Text Filter
Felder:
• field: Feld, auf welches der Filter angewendet werden soll (erforderlich); mögliche Felder:
– uuid
– company
– link
– text.title
– addresses.country
– addresses.county
– addresses.place
– addresses.zipCode
– classifications.companyType
– classifications.companyTypes (andere Schreibweise für classifications.companyType)
– classifications.contractType
– classifications.contractTypes (andere Schreibweise für classifications.contractType)
– classifications.employmentType (mehrere employmentTypes pro Job möglich)
– classifications.employmentTypes (andere Schreibweise für classifications.employmentType)
– classifications.jobType
– classifications.jobTypes (andere Schreibweise für classifications.jobType)
– classifications.occupationAreas (mehrere occupationAreas pro Job möglich)
– classifications.occupationAreas (andere Schreibweise für classifications.occupationAreas)
• is: Wert, welches das angegebene Feld haben muss (bzw. welches beinhaltet ist, bei mehreren Werten pro Feld)
• isNot: Wert, welches das angegebene Feld nicht haben darf
• in: eine Liste von Phrasen, in welcher der Wert des angegebenen Feldes vorkommen muss
Beispiel:
{
"filters": [
{
"field": "addresses.county",
"is": "Aurich",
"type": "text"
},
{
"field": "classifications.employmentTypes",
"in": [
"FULL_TIME",
"PART_TIME"
],
"type": "text"
}
]
}
Distance Filter
Felder:
• distance: Umkreis in Kilometer
• lat: Latitude der Koordinate
• lon: Longitude der Koordinate
7
Beispiel:
{
"filters": [
{
"lat": 53.364150,
"lon": 7.522625,
"distance": 20,
"type": "distance"
}
]
}
Distances Filter
Felder:
• perimeters (eine Liste von):
– distance: Umkreis in Kilometer
– lat: Latitude der Koordinate
– lon: Longitude der Koordinate
Beispiel:
{
"filters": [
{
"perimeters": [
{
"lat": 53.364150,
"lon": 7.522625,
"distance": 20
},
{
"lat": 52.5167,
"lon": 13.4,
"distance": 50
}
],
"type": "distances"
}
]
}
Date Filter
Felder:
• field: Feld, auf welches der Filter angewendet werden soll (erforderlich); mögliche Felder:
– period.dateFrom
– period.dateTo
• is: Datum, welches das angegebene Feld haben muss
• isNot: Datum, welches das angegebene Feld nicht haben darf
• in: eine Liste von Daten, in welcher der Wert des angegebenen Feldes vorkommen muss
• from: Datum, welches das angegebene Feld mindestens haben muss
• max: Datum, welcher das angegebene Feld maximal haben darf
Beispiel:
{
"filters": [
{
8
"field": "period.dateFrom",
"from": "2021-01-01",
"to": "2021-02-01",
"type": "date"
}
]
}
IsSet Filter
Filtern danach, ob ein bestimmtes Feld gesetzt ist.
Felder:
• field: Feld, auf welches der Filter angewendet werden soll (erforderlich); mögliche Felder:
– Siehe Textfilter
Beispiel:
{
"filters": [
{
"field": "period.dateTo",
"type": "isSet"
}
]
}
IsNotSet Filter
Filtern danach, ob ein bestimmtes Feld nicht gesetzt ist.
Felder:
• field: Feld, auf welches der Filter angewendet werden soll (erforderlich); mögliche Felder:
– Siehe Textfilter
Beispiel:
{
"filters": [
{
"field": "period.dateTo",
"type": "isNotSet"
}
]
}
Aggregationen
Mithilfe von Aggregationen können zusätzliche Informationen zur aktuellen Suche hinzugefügt werden. Welche Aggregationen
verwendet werden, wird im Request Body sich mithilfe des aggregations Felds angegeben. Dieses ist eine Liste von Namen der
Aggregationen, welche verwendet werden sollen.
Beispiel:
{
"aggregations": [
"employmentTypes"
]
}
Die Aggregationen werden anschließend im Response Body innerhalb des Felds aggregations zurückgegeben.
Beispiel:
9
{
"aggregations": {
"employmentTypes": [
{
"value": "FULL_TIME",
"jobs": 1629622
},
{
"value": "PART_TIME",
"jobs": 441767
},
{
"value": "MINI_JOB",
"jobs": 103418
}
]
}
}
Die folgenden Aggregationen sind derzeit möglich.
companyTypes
Die companyTypes Aggregation gibt alle Firmenarten sowie die Anzahl der Jobs je Art zurück, welche zur aktuellen Suche
gehören.
Folgende Werte sind für diese Aggregation zurzeit möglich:
• UNDEFINED
• COMPANY
• RECRUITMENT_AGENCY
• PERSONNEL_SERVICES
Rückgabe:
{
"aggregations": {
"companyTypes": [
{
"value": "COMPANY",
"jobs": 1856011
}
]
}
}
contractTypes
Die contractTypes Aggregation gibt alle Vertragsarten sowie die Anzahl der Jobs je Art zurück, welche zur aktuellen Suche
gehören.
Folgende Werte sind für diese Aggregation zurzeit möglich:
• PERMANENT
• TEMPORARY
Rückgabe:
{
"aggregations": {
"contractTypes": [
{
"value": "PERMANENT",
"jobs": 1233599
},
{
10
"value": "TEMPORARY",
"jobs": 622412
}
]
}
}
duplicates
Die duplicates Aggregation gibt die Anzahl der Jobs in der aktuellen Suche, welche Duplikate zu anderen Jobs sind.
Rückgabe:
{
"aggregations": {
"duplicates": 65566
}
}
employmentTypes
Die employmentTypes Aggregation gibt die Art Zeitmodelle der Stellenangebote (z.B. Teilzeit, Vollzeit, etc.) sowie die Anzahl
der Jobs je Art zurück, welche zur aktellen Suche gehören.
Folgende Werte sind für diese Aggregation zurzeit möglich:
• FULL_TIME
• PART_TIME
• MINI_JOB
Rückgabe:
{
"aggregations": {
"employmentTypes": [
{
"value": "FULL_TIME",
"jobs": 1629622
},
{
"value": "PART_TIME",
"jobs": 441767
},
{
"value": "MINI_JOB",
"jobs": 103418
}
]
}
}
jobTypes
Die jobTypes Aggregation gibt die Art der Stellenangebote (z.B. Ausbildung, Praktikum, Werkstudent, etc.) sowie die Anzahl
der Jobs je Art zurück, welche zur aktellen Suche gehören.
Folgende Werte sind für diese Aggregation zurzeit möglich:
• APPRENTICESHIP
• FREELANCER
• INTEGRATED_DEGREE_PROGRAMM
• INTERNSHIP
• OCCUPATION
• STUDENT_EMPLOYEE
• THESIS
• UNDEFINED
11
Rückgabe:
{
"aggregations": {
"jobTypes": [
{
"value": "OCCUPATION",
"jobs": 1106313
},
{
"value": "APPRENTICESHIP",
"jobs": 599259
},
{
"value": "INTEGRATED_DEGREE_PROGRAMM",
"jobs": 58052
},
{
"value": "INTERNSHIP",
"jobs": 39023
},
{
"value": "STUDENT_EMPLOYEE",
"jobs": 29405
},
{
"value": "FREELANCER",
"jobs": 19868
},
{
"value": "THESIS",
"jobs": 4091
}
]
}
}
employmentTypes
Die occupationAreas Aggregation gibt die Berufsfelder der Stellenangebote (z.B. IT, Vertrieb und Verkauf, etc.) sowie die
Anzahl der Jobs je Art zurück, welche zur aktellen Suche gehören.
Rückgabe:
{
"aggregations": {
"occupationAreas": [
{
"value": "unkategorisiert",
"jobs": 505858
},
{
"value": "Handwerk, Dienstleistung und Fertigung",
"jobs": 378025
},
{
"value": "Ingenieure und technische Berufe",
"jobs": 190320
},
{
"value": "Pflege, Therapie und Assistenz",
"jobs": 130704
},
12
{
"value": "IT",
"jobs": 128456
},
{
"value": "Vertrieb und Verkauf",
"jobs": 116506
},
{
"value": "Einkauf, Materialwirtschaft und Logistik",
"jobs": 101919
},
{
"value": "Bildung und Soziales",
"jobs": 46740
}
]
}
}
softSkills
Die softSkills Aggregation gibt die erkannten unbereinigten Soft Skills der Stellenangebote der aktuellen Suche zurück.
Rückgabe:
{
"aggregations": {
"softSkills": [
{
"skill": "Teamfähigkeit",
"count": 20826
},
{
"skill": "Zuverlässigkeit",
"count": 16164
},
{
"skill": "Flexibilität",
"count": 12449
},
{
"skill": "Belastbarkeit",
"count": 8083
},
...
]
}
}
itSkills
Die itSkills Aggregation gibt die erkannten unbereinigten IT Skills der Stellenangebote der aktuellen Suche zurück.
Rückgabe:
{
"aggregations": {
"itSkills": [
{
"skill": "Excel",
"count": 3183
},
{
13
"skill": "Gute",
"count": 3118
},
{
"skill": "SAP",
"count": 2566
},
{
"skill": "MS Office",
"count": 2312
},
...
]
},
degreeCertificate
Die degreeCertificate Aggregation gibt die erkannten unbereinigten benötigten Abschlüsse der Stellenangebote der aktuellen
Suche zurück.
Rückgabe:
{
"aggregations": {
"degreeCertificate": [
{
"skill": "Berufserfahrung",
"count": 5736
},
{
"skill": "Elektrotechnik",
"count": 5355
},
{
"skill": "Industriemechaniker",
"count": 3865
},
{
"skill": "Mechatroniker",
"count": 3406
}
...
]
}
cleanedItSkills
Die cleanedItSkills Aggregation gibt die erkannten bereinigten IT Skills der Stellenangebote der aktuellen Suche zurück.
Rückgabe:
{
"aggregations": {
"cleanedItSkills": [
{
"cleanedItSkills": "Microsoft Office",
"count": 24380
},
{
"cleanedItSkills": "Microsoft Excel",
"count": 5599
},
{
"cleanedItSkills": "Microsoft Word",
14
"count": 2709
},
{
"cleanedItSkills": "C",
"count": 1948
},
...
]
}
cleanedSoftSkills
Die cleanedSoftSkills Aggregation gibt die erkannten bereinigten Soft Skills der Stellenangebote der aktuellen Suche zurück.
Rückgabe:
{
"aggregations": {
"cleanedSoftSkills": [
{
"cleanedSoftSkills": "Teamfähigkeit",
"count": 93405
},
{
"cleanedSoftSkills": "Zuverlässigkeit",
"count": 72830
},
{
"cleanedSoftSkills": "Kommunikationsfähigkeit",
"count": 71710
},
{
"cleanedSoftSkills": "Sonstige",
"count": 66913
},
...
]
}
sources
Die sources Aggregation gibt alle Quellen der Stellenangebote sowie die Anzahl der Jobs je Quelle, welche zur aktellen Suche
gehören.
Rückgabe:
{
"aggregations": {
"sources": [
{
"source": "finbot",
"jobs": 561420
},
{
"source": "job4you",
"jobs": 543117
},
{
"source": "finbot_homepages",
"jobs": 143850
},
{
"source": "jobninja",
"jobs": 134832
15
},
{
"source": "stepstone",
"jobs": 104810
}
]
}
}
topEmployers
Die topEmployers Aggregation gibt die (bereinigten) Namen der Top Arbeitgeber der aktuellen suche zurück.
Rückgabe:
{
"aggregations": {
"topEmployers": [
{
"value": "Test GmbH",
"jobs": 11461
},
{
"value": "Arbeitgeber GmbH & Co. KG",
"jobs": 11070
}
]
}
}
topJobTitles
Die topJobTitles Aggregation gibt die Top (bereinigten) Stellentitel der aktuellen suche zurück.
Rückgabe:
{
"aggregations": [
{
"value": "Produktionsmitarbeiter",
"jobs": 1916
},
{
"value": "Staplerfahrer",
"jobs": 1390
},
{
"value": "Industriemechaniker",
"jobs": 1295
}
]
}
topWerNERSubjects (experimentell)
Die topWerNERSubjects Aggregation gibt die erkannten werNER SUBJECTS der aktuellen Suche zurück.
Rückgabe:
{
"aggregations": {
"topWerNERTitles": [
{
"value": "Mitarbeiter",
"tags": 16833
16
},
{
"value": "Helfer",
"tags": 6707
},
{
"value": "Sachbearbeiter",
"tags": 5935
},
{
"value": "Verkäufer",
"tags": 5333
}
]
}
}
topWerNERTitles (experimentell)
Die topWerNERTitles Aggregation gibt die erkannten werNER TITLES der aktuellen suche zurück.
Rückgabe:
{
"aggregations": {
"topWerNERTitles": [
{
"value": "Mitarbeiter",
"tags": 16833
},
{
"value": "Helfer",
"tags": 6707
},
{
"value": "Sachbearbeiter",
"tags": 5935
},
{
"value": "Verkäufer",
"tags": 5333
}
]
}
}
topWorkPlaces
Die topJobTitles Aggregation gibt die Top Arbeitsorte der aktuellen suche zurück.
Rückgabe:
{
"aggregations": {
"topWorkPlaces": [
{
"value": "Berlin",
"jobs": 25255
},
{
"value": "München",
"jobs": 10106
},
{
17
"value": "Hamburg",
"jobs": 8526
},
{
"value": "Dresden",
"jobs": 4785
},
{
"value": "Köln",
"jobs": 4447
}
]
}
}
Highlighting
Durch die Benutzung der Highlighting Funktion lassen sich die gefundenen Textstellen der Queries zurückgeben.
Felder:
• fields: Felder, für welche die Highlights zurückgegeben werden sollen (Default: alle, welche für die Queries gesetzt sind;
mögliche Werte: siehe mögliche Werte der Query Felder)
• preTag: String, welcher vor einem Highlight steht (Default: <b>)
• postTag: String, welcher hinter einem Highlight steht (Default: </b>)
Beispiel:
{
"queries": [
{
"fields": [
"text.title"
],
"phrase": "Python",
"type": "single"
}
],
"highlighting": {
"fields": [
"text.title",
"text.fulltext"
],
"preTag": "<highlight>",
"postTag": "</highlight>"
}
}
Search Response Body
{
"aggregations": {
"employmentTypes": [
{
"value": "FULL_TIME",
"jobs": 2
},
{
"value": "PART_TIME",
"jobs": 1
}
]
},
"hits": 2,
18
"jobs": [
{
"uuid": "00000000-0000-0000-0000-000000000001",
"link": "https://jobs.existiert.net/1",
"company": "HR4YOU AG",
"text": {
"title": "Python Test Entwickler",
"fulltext": "Wir suchen zu sofort einen Python Test Entwickler.",
"company": "Die HR4YOU AG ist...",
"tasks": [
"Testen von Schnittstellen...",
"..."
],
"requirements": [
"Abgeschlossene Ausbildung als...",
"..."
],
"benefits": [
"Wir bieten...",
"..."
],
"closing": "Du fühlst Dich angesprochen? ..."
},
"period": {
"dateFrom": "2021-03-01",
"dateTo": null
},
"addresses": [
{
"place": "Timmel",
"country": "Deutschland",
"county": "Aurich",
"zipCode": "26629"
}
],
"counterpart": {
"firstName": "Max",
"lastName": "Mustermann",
"role": "HR",
"department": null,
"phone": "04945 915900",
"fax": null,
"email": "info@hr4you.de",
"address": {
"place": "Großefehn",
"country": "Deutschland",
"county": "Aurich",
"zipCode": "26629"
}
},
"classifications": {
"companyType": "COMPANY",
"contractTypes": [
"PERMANENT"
],
"employmentTypes": [
"FULL_TIME"
],
"jobTypes": [
"OCCUPATION"
],
19
"occupationAreas": [
"IT"
]
},
"score": 0.98142844,
"highlights": {
"text.fulltext": [
"Wir suchen zu sofort einen <b>Python</b> Test Entwickler."
],
"text.title": [
"<b>Python</b> Test Entwickler"
]
}
}
],
"page": 1
}
Job Details
Gibt alle Informationen zum Stellenangebot mit der angegebenen UUID zurück.
Job Details Request
• Method: GET
• URI: /jobs/<uuid>
Job Details Response Code
Erwarteter Status Code: 200 OK
Existiert kein Stellenangebot mit der angegebenen UUID, wird die Request mit dem Status 404 NOT FOUND unterbrochen.
Job Details Response
{
"uuid": "708784a9-01df-4d08-b28e-fc4a34825478",
"link": "https://de.indeed.com/viewjob?jk=65461f27286a2a25",
"company": "CAS Software AG",
"companyCleaned": "CAS Software AG",
"text": {
"title": "Praktikum Softwareentwicklung Java HTML5 JavaScript",
"titleCleaned": "Praktikum Softwareentwicklung Java HTML5 JavaScript",
"fulltext": "<div id=\"jobDescriptionText\" class=\"jobsearch-JobComponent-description css-wppltw eu4oa1w0\""company": "",
"tasks": [
" - Mitarbeit in disziplinübergreifenden Scrum-Teams zur Weiterentwicklung unserer\n Produktlösu" - Integration in Entwicklungsteams und -aufgaben mit direkter Anwendung agiler\n Softwareentwi" - Entwicklung innovativer Produkte und Kundenlösungen, wobei die eingesetzten\n Technologien(" - Sicherstellung von Qualität durch Clean Code, automatisierte Tests und Code Reviews.",
" - Anwendung von Continuous Integration Tools wie Jenkins, Maven und Git."
],
"requirements": [
" - Du studierst in einem informatikorientierten Studiengang.",
" - Du bist nicht mehr grün hinter den Ohren, wenn es um Softwareentwicklung mit\n objektorienti" - Du möchtest an einem realen Projekt oder Produkt mitarbeiten– mit echten\n Herausforderungen" - Wir sind als innovatives Unternehmen bekannt, darum solltest du neugierig sein, um neue\n We],
"benefits": [
" <p> Neben unserer Wir-Kultur und dem Fokus auf gesunde Beziehungen bieten wir unseren\n Mitgestalterin" Auf dich wartet fachliches und persönliches Mentoring durch deine Patin bzw.\n deinen Paten. Von Begin" In unserem Culinarium erhältst du Studierenden-Rabatt und tankst Energie für die\n zweite Tageshälfte." Wir haben ein großes Netzwerk aus Studierenden, mit denen du dich auf unseren\n Studi-Events, wie z. B20
],
"closing": ""
},
"period": {
"dateFrom": "2025-02-03",
"dateTo": null
},
"addresses": [
{
"place": "Karlsruhe",
"country": "DE",
"county": "Prignitz",
"zipCode": "19322",
"street": null,
"streetNumber": null,
"coordinates": {
"lat": 53.0,
"lon": 11.75
}
}
],
"counterpart": {
"firstName": "",
"lastName": "",
"role": "",
"department": "",
"phone": "",
"fax": "",
"email": "",
"address": {
"place": "",
"country": "",
"county": "",
"zipCode": "",
"street": null,
"streetNumber": null,
"coordinates": null
}
},
"classifications": {
"companyType": "COMPANY",
"contractTypes": [
"PERMANENT"
],
"employmentTypes": [
"FULL_TIME"
],
"jobTypes": [
"INTERNSHIP"
],
"occupationAreas": [
"IT"
],
"werNERTags": [
{
"text": "Praktikum",
"label": "TYPE",
"category": null
},
{
"text": "Softwareentwicklung",
21
"label": "SUBJECT",
"category": null
},
{
"text": "Java",
"label": "SUBJECT",
"category": null
},
{
"text": "JavaScript",
"label": "SUBJECT",
"category": null
}
],
"experienceLevel": "UNDEFINED",
"taxonomyJobTitle": {
"text": "Nicht zugeordnet",
"label": "Nicht zugeordnet",
"category": "Nicht zugeordnet"
},
"itSkills": [],
"softSkills": [
{
"text": "innovativ",
"label": "Innovation",
"category": "Kreativität"
},
{
"text": "neugier",
"label": "Neugier",
"category": "Lernbereitschaft"
}
]
},
"skillTags": [
{
"text": "informatikorientierten Studiengang.",
"label": "requirement_Wissensgebiet",
"category": null
},
{
"text": "grün",
"label": "requirement_Soft Skill",
"category": null
},
{
"text": "den Ohren",
"label": "requirement_Soft Skill",
"category": null
},
{
"text": "Softwareentwicklung mit objektorientierten Technologien",
"label": "requirement_IT Skill",
"category": null
},
{
"text": "innovatives",
"label": "requirement_Soft Skill",
"category": null
},
{
22
"text": "neugierig",
"label": "requirement_Soft Skill",
"category": null
},
{
"text": "Wege zu erkunden.",
"label": "requirement_Soft Skill",
"category": null
}
],
"score": 0.0,
"highlights": {}
}
